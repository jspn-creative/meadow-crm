import * as Alchemy from "alchemy";
import { AlchemyContext } from "alchemy/AlchemyContext";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

// Reference only: this stack never declares a database, schema, migration, seed, or import.
export default Alchemy.Stack(
	"MeadowLiveDev",
	{
		providers: Cloudflare.providers(),
		state: Cloudflare.state(),
	},
	Effect.gen(function* () {
		const context = yield* AlchemyContext;
		const stack = yield* Alchemy.Stack;
		if (!context.dev || stack.stage !== "live" || process.env.MEADOW_LIVE_PRODUCTION !== "true")
			throw new Error("Live production access is restricted to vp run dev:live.");
		if (process.env.CLOUDFLARE_ACCOUNT_ID !== "e1c1047c245641f3c40cb70ea0d8f7c6")
			throw new Error("Live development is restricted to JSPN.");
		if (process.env.LOCAL_IDENTITY_STUB === "true")
			throw new Error("Live development never permits the local identity stub.");
		const database = yield* Cloudflare.D1.Database.ref("Database", {
			stack: "Meadow",
			stage: "prod",
		});
		const site = yield* Cloudflare.Website.SvelteKit("Website", {
			name: "meadow-live-dev",
			dev: { host: "localhost", port: 1337, strictPort: true },
			env: {
				DB: database,
				BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
				BETTER_AUTH_URL: "http://localhost:1337",
				LOCAL_IDENTITY_STUB: "false",
				LOCAL_DEMO_USER: "realtor",
			},
		});
		return { url: site.url, databaseId: database.databaseId };
	}),
);

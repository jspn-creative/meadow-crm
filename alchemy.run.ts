import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Drizzle from "@alchemy.run/drizzle";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const Database = Cloudflare.D1.Database(
	"Database",
	Effect.gen(function* () {
		const stage = yield* Stage;
		const schema = yield* Drizzle.Schema("Schema", {
			schema: "./src/lib/server/db/schema.ts",
			dialect: "sqlite",
		});
		return { name: stage === "prod" ? "meadow-db" : `meadow-db-${stage}`, migrations: schema };
	}),
).pipe(RemovalPolicy.retain(Effect.map(Stage, (stage) => stage === "prod")));

export const Website = Cloudflare.Website.SvelteKit(
	"Website",
	Effect.gen(function* () {
		const stage = yield* Stage;
		const database = yield* Database;
		return {
			name: stage === "prod" ? "meadow" : stage === "spike" ? "meadow-spike" : "meadow-dev",
			dev: { host: process.env.MEADOW_DEV_HOST ?? "localhost", port: 1337, strictPort: true },
			env: {
				DB: database,
				BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
				BETTER_AUTH_URL:
					stage === "prod"
						? "https://meadow.jspn.workers.dev"
						: stage === "spike"
							? "https://meadow-spike.jspn.workers.dev"
							: (process.env.MEADOW_DEV_URL ?? "http://localhost:1337"),
				LOCAL_IDENTITY_STUB: stage === "dev" ? (process.env.LOCAL_IDENTITY_STUB ?? "false") : "false",
				LOCAL_DEMO_USER: stage === "dev" ? (process.env.LOCAL_DEMO_USER ?? "realtor") : "realtor",
			},
		};
	}),
).pipe(adopt(Effect.map(Stage, (stage) => stage === "prod")));

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
	"Meadow",
	{
		providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers()),
		state: Layer.unwrap(
			Effect.gen(function* () {
				const stage = yield* Stage;
				return stage === "prod" ? Cloudflare.state() : Alchemy.localState();
			}),
		),
	},
	Effect.gen(function* () {
		const stack = yield* Alchemy.Stack;
		const production = stack.stage === "prod";
		const spike = stack.stage === "spike";
		if (!production && !spike && stack.stage !== "dev")
			throw new Error("Only prod, spike, and dev stages are declared.");
		if (
			process.env.CLOUDFLARE_ACCOUNT_ID &&
			process.env.CLOUDFLARE_ACCOUNT_ID !== "e1c1047c245641f3c40cb70ea0d8f7c6"
		)
			throw new Error("Meadow deploys are restricted to Cloudflare account JSPN.");
		if (production && process.env.MEADOW_APPROVED_PRODUCTION !== "true")
			throw new Error("Production deployment requires explicit developer approval.");
		if (production && (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32))
			throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");
		const database = yield* Database;
		const site = yield* Website;
		return { url: site.url, databaseId: database.databaseId };
	}),
);

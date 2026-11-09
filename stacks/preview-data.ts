import * as Alchemy from "alchemy";
import { Stage } from "alchemy/Stage";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";

// Each generation has its own state, so refreshing cannot remove a snapshot being cloned.
export default Alchemy.Stack(
	"MeadowPreviewData",
	{ providers: Cloudflare.providers(), state: Cloudflare.state() },
	Effect.gen(function* () {
		const stage = yield* Stage;
		if (!/^snapshot-\d{13}$/.test(stage)) throw new Error("A dated snapshot stage is required.");
		if (process.env.CLOUDFLARE_ACCOUNT_ID !== "e1c1047c245641f3c40cb70ea0d8f7c6")
			throw new Error("Preview snapshots are restricted to Cloudflare account JSPN.");
		const database = yield* Cloudflare.D1.Database("Snapshot", {
			name: `meadow-preview-data-${stage}`,
			clone: { databaseId: "f3dcaa0f-97ad-4403-b32d-a2164027c64d" },
			importFiles: ["./scripts/preview-sanitize.sql", "./scripts/preview-snapshot-ready.sql"],
		});
		return { databaseId: database.databaseId };
	}),
);

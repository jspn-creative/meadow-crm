import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";
import * as Output from "alchemy/Output";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Drizzle from "@alchemy.run/drizzle";
import * as GitHub from "@alchemy.run/github";
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
		const preview = /^pr-[1-9]\d*$/.test(stage);
		// Monthly replacements clone the shared snapshot before applying PR migrations.
		const month = new Date().toISOString().slice(0, 7);
		const snapshotId = process.env.MEADOW_PREVIEW_SNAPSHOT_ID;
		if (
			preview &&
			(!snapshotId ||
				!/^[a-f\d-]{36}$/i.test(snapshotId) ||
				snapshotId === "f3dcaa0f-97ad-4403-b32d-a2164027c64d")
		)
			throw new Error("PR previews require a separate, sanitized snapshot database.");
		return {
			name:
				stage === "prod" ? "meadow-db" : preview ? `meadow-db-${stage}-${month}` : `meadow-db-${stage}`,
			migrations: schema,
			...(preview
				? {
						clone: { databaseId: snapshotId! },
						importFiles: ["./scripts/preview-sanitize.sql"],
					}
				: {}),
		};
	}),
).pipe(RemovalPolicy.retain(Effect.map(Stage, (stage) => stage === "prod")));

// Temporary beta feedback notes and drawings, kept apart from the CRM's records.
export const Feedback = Cloudflare.KV.Namespace(
	"Feedback",
	Effect.map(Stage, (stage) => ({
		title: stage === "prod" ? "meadow-feedback" : `meadow-feedback-${stage}`,
	})),
).pipe(RemovalPolicy.retain(Effect.map(Stage, (stage) => stage === "prod")));

export const Website = Cloudflare.Website.SvelteKit(
	"Website",
	Effect.gen(function* () {
		const stage = yield* Stage;
		const database = yield* Database;
		const feedback = yield* Feedback;
		return {
			name: stage === "prod" ? "meadow" : `meadow-${stage}`,
			dev: { host: process.env.MEADOW_DEV_HOST ?? "localhost", port: 1337, strictPort: true },
			env: {
				DB: database,
				FEEDBACK: feedback,
				BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
				BETTER_AUTH_URL:
					stage === "prod"
						? "https://meadow.jspn.workers.dev"
						: stage === "dev"
							? (process.env.MEADOW_DEV_URL ?? "http://localhost:1337")
							: Cloudflare.URL,
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
		providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers(), GitHub.providers()),
		state: Layer.unwrap(
			Effect.gen(function* () {
				const stage = yield* Stage;
				return stage === "prod" || /^pr-[1-9]\d*$/.test(stage)
					? Cloudflare.state()
					: Alchemy.localState();
			}),
		),
	},
	Effect.gen(function* () {
		const stack = yield* Alchemy.Stack;
		const production = stack.stage === "prod";
		const preview = /^pr-[1-9]\d*$/.test(stack.stage);
		if (!production && !preview && stack.stage !== "dev")
			throw new Error("Only prod, dev, and pr-<number> stages are declared.");
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
		const github = preview ? yield* GitHub.GitHubEnv : undefined;
		if (preview && github?.pr) {
			if (stack.stage !== `pr-${github.pr}`)
				throw new Error("Preview stage must match the pull request.");
			yield* GitHub.Comment("PreviewComment", {
				owner: github.owner,
				repository: github.repository,
				issueNumber: github.pr,
				body: Output.interpolate`Preview: ${site.url}\n\nCommit: ${github.sha.slice(0, 7)}. Uses a separate database cloned from a dated production snapshot. Preview databases refresh monthly; preview edits never write back to production and are discarded at refresh. Sign in with your usual account.`,
				allowDelete: true,
			});
		}
		return { url: site.url, databaseId: database.databaseId };
	}),
);

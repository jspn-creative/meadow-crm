import { spawnSync } from "node:child_process";
import { requireProjectCloudflareCredentials } from "./project-env.ts";

const args = process.argv.slice(2).filter((arg: string) => arg !== "--");
const stageIndex = args.indexOf("--stage");
const stage = stageIndex >= 0 ? args[stageIndex + 1] : undefined;
if (args.length !== 2 || stageIndex !== 0 || !["prod", "spike"].includes(stage ?? ""))
	throw new Error("Usage: vp run deploy -- --stage prod|spike");
requireProjectCloudflareCredentials(stage === "prod");
if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)
	throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");

const result = spawnSync(
	"vp",
	["exec", "--", "alchemy", "deploy", "--stage", stage!, "--env-file", ".env", "--yes"],
	{
		stdio: "inherit",
	},
);
if (result.error) throw new Error("Failed to run alchemy deploy.");
if (result.status !== 0) process.exit(result.status ?? 1);

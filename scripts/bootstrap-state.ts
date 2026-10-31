import { spawnSync } from "node:child_process";
import { requireProjectCloudflareCredentials } from "./project-env.ts";

requireProjectCloudflareCredentials(true);
const result = spawnSync(
	"vp",
	["exec", "--", "alchemy", "state", "bootstrap", "--backend", "cloudflare", "--env-file", ".env"],
	{ stdio: "inherit" },
);
if (result.error) throw new Error("Failed to run the Alchemy state-store bootstrap command.");
if (result.status !== 0) process.exit(result.status ?? 1);

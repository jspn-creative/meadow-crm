import { readFile } from "node:fs/promises";
import { getPlatformProxy } from "@alchemy.run/cloudflare-runtime/core/platform-proxy";
import { D1 } from "@alchemy.run/cloudflare-runtime/core/bindings";
import type { D1Database } from "@cloudflare/workers-types";

// Read only the stack's explicitly exported nonsecret outputs, never resource state or credentials.
export async function localD1Database() {
	let output: { databaseId?: string };
	try {
		output = JSON.parse(
			await readFile(
				new URL("../.alchemy/state/Meadow/dev/__stack_output__.json", import.meta.url),
				"utf8",
			),
		);
	} catch {
		throw new Error("Start vp run dev:local first; Alchemy must provision and migrate local D1.");
	}
	if (!output.databaseId?.startsWith("dev:")) throw new Error("Refusing a nonlocal database ID.");
	return getPlatformProxy<{ DB: D1Database }>({
		name: "meadow-local-scripts",
		bindings: [D1.local({ binding: "DB", id: output.databaseId })],
		persist: { directory: new URL("../.alchemy/local", import.meta.url).pathname },
	});
}

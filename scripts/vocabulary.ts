import { readFile, writeFile } from "node:fs/promises";
import { replaceVocabulary } from "../src/lib/glossary/markdown.ts";

// Renders src/lib/glossary/vocabulary.ts into AGENTS.md. With --check, fails instead of writing when AGENTS.md is stale.
const path = new URL("../AGENTS.md", import.meta.url);
const current = await readFile(path, "utf8");
const next = replaceVocabulary(current);

if (process.argv.includes("--check")) {
	if (next !== current) {
		console.error("AGENTS.md vocabulary is out of date. Run `vp run vocabulary`.");
		process.exit(1);
	}
	console.log("AGENTS.md vocabulary is up to date.");
} else if (next !== current) {
	await writeFile(path, next);
	console.log("Updated the AGENTS.md vocabulary.");
} else {
	console.log("AGENTS.md vocabulary is already up to date.");
}

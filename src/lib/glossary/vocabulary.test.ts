import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { replaceVocabulary } from "./markdown.ts";
import { kinds, vocabulary, type Term } from "./vocabulary.ts";

const flatten = (terms: Term[]): Term[] =>
	terms.flatMap((entry) => [entry, ...flatten(entry.children ?? [])]);

describe("vocabulary", () => {
	it("is rendered into AGENTS.md", () => {
		const agents = readFileSync(new URL("../../../AGENTS.md", import.meta.url), "utf8");
		expect(replaceVocabulary(agents), "Run `vp run vocabulary` to update AGENTS.md.").toBe(agents);
	});

	it("names every concept once", () => {
		const names = flatten(vocabulary).map((entry) => entry.term.toLowerCase());
		expect(new Set(names).size).toBe(names.length);
	});

	it("uses known kinds", () => {
		expect(flatten(vocabulary).every((entry) => kinds.includes(entry.kind))).toBe(true);
	});
});

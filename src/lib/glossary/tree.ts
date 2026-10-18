import { vocabulary, type Term } from "./vocabulary.ts";

export const slug = (term: string) => term.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");

export type Guide = { depth: number; last: boolean; continues: boolean[] };

/** Connector-line state for a flat, depth-first list of visible rows. `continues[level - 1]` says whether the ancestor at that depth has later siblings, so its parent's line keeps running past this row. */
export function treeGuides(depths: number[]): Guide[] {
	const last = depths.map((depth, index) => {
		for (let next = index + 1; next < depths.length; next++) {
			if (depths[next] < depth) return true;
			if (depths[next] === depth) return false;
		}
		return true;
	});
	return depths.map((depth, index) => {
		const continues: boolean[] = [];
		for (let level = 1; level < depth; level++) {
			let ancestor = index - 1;
			while (ancestor >= 0 && depths[ancestor] !== level) ancestor--;
			continues.push(ancestor >= 0 && !last[ancestor]);
		}
		return { depth, last: last[index], continues };
	});
}

type Indexed = { entry: Term; path: string[] };
const index: Indexed[] = [];
(function walk(terms: Term[], path: string[]) {
	for (const entry of terms) {
		index.push({ entry, path });
		walk(entry.children ?? [], [...path, entry.term]);
	}
})(vocabulary, []);

export const allTerms = index.map(({ entry }) => entry);

/** Ancestor terms, outermost first. */
export const pathOf = (term: string) => index.find(({ entry }) => entry.term === term)?.path ?? [];

/** Other terms whose meaning names this one. */
export function mentionsOf(term: string) {
	const pattern = new RegExp(`\\b${term.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
	return allTerms.filter((entry) => entry.term !== term && pattern.test(entry.meaning));
}

/** Maps each word to avoid (without its parenthetical note) to the term to use instead. */
const avoided = new Map(
	allTerms.flatMap((entry) =>
		(entry.not ?? []).map((word) => [word.replace(/\s*\(.*\)$/, "").toLowerCase(), entry] as const),
	),
);

export const insteadOf = (word: string) => avoided.get(word.trim().toLowerCase());

/** Splits "agent (in this repo, an agent is an AI coding agent)" into the word to avoid and its note. */
export function splitAvoid(text: string) {
	const match = text.match(/^(.*?)\s*\((.*)\)$/);
	return match ? { word: match[1], note: match[2] } : { word: text, note: undefined };
}

import { kindDescriptions, kinds, vocabulary, type Term } from "./vocabulary.ts";

export const markers = { start: "<!-- vocabulary:start -->", end: "<!-- vocabulary:end -->" };

const cell = (text: string) => text.replaceAll("|", "\\|");

function rows(terms: Term[], parent?: string): string[] {
	return terms.flatMap((entry) => {
		const meaning = entry.open ? `${entry.meaning} *Open:* ${entry.open}` : entry.meaning;
		const row = `| ${cell(entry.term)} | ${entry.kind} | ${parent ?? ""} | ${cell(meaning)} | ${cell((entry.not ?? []).join(", "))} |`;
		return [row, ...rows(entry.children ?? [], entry.term)];
	});
}

function table(heading: string, terms: Term[]) {
	return [
		`### ${heading}`,
		"",
		"| Term | Kind | Belongs to | Meaning | Not |",
		"| --- | --- | --- | --- | --- |",
		...rows(terms),
	].join("\n");
}

/** One table per top-level branch; top-level terms without children share a table. */
export function renderVocabulary(terms: Term[] = vocabulary) {
	const sections: string[] = [];
	let structure: Term[] | undefined;
	for (const entry of terms) {
		if (entry.children?.length) {
			sections.push(table(entry.term, [entry]));
		} else if (structure) {
			structure.push(entry);
		} else {
			structure = [entry];
			sections.push("");
		}
	}
	const kindTable = [
		"### Kinds",
		"",
		"| Kind | Meaning |",
		"| --- | --- |",
		...kinds.map((kind) => `| ${kind} | ${cell(kindDescriptions[kind])} |`),
	].join("\n");
	// The shared table takes the slot of its first term, so the reading order follows the source.
	return [
		kindTable,
		...sections.map((section) => section || table("Product structure", structure ?? [])),
	].join("\n\n");
}

export function replaceVocabulary(document: string, rendered = renderVocabulary()) {
	const start = document.indexOf(markers.start);
	const end = document.indexOf(markers.end);
	if (start < 0 || end < start) throw new Error("AGENTS.md is missing the vocabulary markers.");
	return `${document.slice(0, start + markers.start.length)}\n\n${rendered}\n\n${document.slice(end)}`;
}

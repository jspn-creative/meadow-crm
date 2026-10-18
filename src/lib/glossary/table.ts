import type { Term } from "./vocabulary.ts";

/** The slice of a TanStack row the glossary variants use. */
export type GlossaryRow = {
	id: string;
	depth: number;
	original: Term;
	getCanExpand: () => boolean;
	getIsExpanded: () => boolean;
	toggleExpanded: (expanded?: boolean) => void;
};

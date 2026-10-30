import { Armchair, Hammer, KeyRound, Signpost } from "@lucide/svelte";

export const stageLabels = {
	"new-lead": "New lead",
	"active-lead": "Active lead",
	"under-contract": "Under contract",
	closed: "Closed",
} as const;
export const typeLabels = {
	buyer: "Buyer",
	seller: "Seller",
	"estate-sale": "Estate Sale",
	construction: "Construction",
} as const;
export const timelineLabels = {
	"1-3-mo": "1–3 mo",
	"3-6-mo": "3–6 mo",
	"6-plus-mo": "6+ mo",
} as const;

// Stages keep the muted semantic hues the dashboard's Pipeline summary already uses.
export const stageTones = {
	"new-lead": "info",
	"active-lead": "pending",
	"under-contract": "tour",
	closed: "success",
} as const;

// Type distinguishes the cards, so each type owns one bright pastel family and an icon.
export const typeStyles = {
	buyer: { tone: "sky", icon: KeyRound },
	seller: { tone: "amber", icon: Signpost },
	"estate-sale": { tone: "violet", icon: Armchair },
	construction: { tone: "teal", icon: Hammer },
} as const;

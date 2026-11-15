/** Describe flag changes without repeating the note in activity summaries. */
export function flagChangeLabel(action: string, data: Record<string, unknown>): string | null {
	const before = data.before as Record<string, unknown> | undefined;
	const after = data.after as Record<string, unknown> | undefined;
	if (action === "activate-review")
		return before?.archivedAt ? "restored and flagged for review" : "flagged for review";
	if (action !== "edit") return null;
	if (!before || !after || typeof after.flagged !== "boolean") return null;
	if (before.flagged !== after.flagged)
		return after.flagged ? "flagged for review" : "cleared the flag";
	if (after.flagged && before.flagNote !== after.flagNote) return "updated the flag note";
	return null;
}

import { getWorkspace, moveStage, saveChecklistStep } from "#lib/crm.remote.js";

export type Workspace = Awaited<ReturnType<typeof getWorkspace>>;
export type StageMove = Parameters<typeof moveStage>[0];

export function identityKey(identity: Workspace["identity"]) {
	return JSON.stringify([identity.actorUserId, identity.effectiveUserId]);
}

// The remote query owns confirmed records and temporary overlays; projections never store another copy.
export function workspaceData(query: ReturnType<typeof getWorkspace>) {
	const scope = query.ready ? identityKey(query.current.identity) : null;
	let disposed = false;
	function current() {
		if (disposed || !query.ready || identityKey(query.current.identity) !== scope)
			throw new Error("Workspace identity changed. Reopen the workspace before saving.");
		return query.current;
	}
	return {
		get current() {
			return current();
		},
		async move(input: StageMove) {
			current();
			await moveStage(input).updates(
				query.withOverride((snapshot) => ({
					...snapshot,
					opportunities: snapshot.opportunities.map((row) =>
						row.id === input.id ? { ...row, stage: input.stage } : row,
					),
				})),
			);
		},
		async saveStep(input: Parameters<typeof saveChecklistStep>[0]) {
			current();
			await saveChecklistStep(input).updates(
				query.withOverride((snapshot) => ({
					...snapshot,
					checklists: snapshot.checklists.map((list) =>
						list.id === input.checklistId
							? {
									...list,
									items: list.items.map((item) =>
										item.id === input.itemId
											? {
													...item,
													dueDate: input.dueDate,
													completedAt: input.completed ? new Date().toISOString() : null,
												}
											: item,
									),
								}
							: list,
					),
				})),
			);
		},
		dispose() {
			disposed = true;
		},
	};
}

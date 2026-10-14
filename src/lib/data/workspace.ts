import { getWorkspace, moveStage } from "#lib/crm.remote.js";

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
		dispose() {
			disposed = true;
		},
	};
}

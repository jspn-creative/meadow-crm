import { createCollection, localOnlyCollectionOptions } from "@tanstack/svelte-db";
import { identityKey, type Workspace, type StageMove } from "#lib/data/workspace.js";

// Session-bounded proof only: these collections deliberately expose the second cache required by this adapter.
export function tanstackExperiment(
	snapshot: Workspace,
	persist: (input: StageMove) => Promise<unknown>,
) {
	const scope = identityKey(snapshot.identity);
	const clients = createCollection(
		localOnlyCollectionOptions({
			id: `experiment-clients-${scope}-${crypto.randomUUID()}`,
			getKey: (row: Workspace["clients"][number]) => row.id,
			initialData: snapshot.clients,
		}),
	);
	const opportunities = createCollection(
		localOnlyCollectionOptions({
			id: `experiment-opportunities-${scope}-${crypto.randomUUID()}`,
			getKey: (row: Workspace["opportunities"][number]) => row.id,
			initialData: snapshot.opportunities,
			onUpdate: async ({ transaction }) => {
				const change = transaction.mutations[0];
				await persist({
					requestId: crypto.randomUUID(),
					id: change.original.id,
					revision: change.original.revision,
					stage: change.modified.stage,
				});
			},
		}),
	);
	let disposed = false;
	return {
		scope,
		clients,
		opportunities,
		move(id: string, stage: StageMove["stage"]) {
			if (disposed) throw new Error("Experiment identity was disposed.");
			return opportunities.update(id, (row) => {
				row.stage = stage;
				row.revision += 1;
			});
		},
		async dispose() {
			disposed = true;
			await Promise.all([clients.cleanup(), opportunities.cleanup()]);
		},
	};
}

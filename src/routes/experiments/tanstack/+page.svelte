<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { page } from "$app/state";
	import { useLiveQuery } from "@tanstack/svelte-db";
	import { getWorkspace, moveStage } from "#lib/crm.remote.js";
	import { tanstackExperiment } from "#lib/experiments/tanstack.js";

	const remote = getWorkspace({ archived: false });
	const snapshot = await remote;
	const experiment = tanstackExperiment(snapshot, (input) => moveStage(input).updates(remote));
	const registry = useLiveQuery((q) => q.from({ client: experiment.clients }));
	const dashboard = useLiveQuery((q) => q.from({ opportunity: experiment.opportunities }));
	const stages = ["new-lead", "active-lead", "under-contract", "closed"] as const;
	let pending = $state(false);
	let hydrated = $state(false);
	let failure = $state("");
	let movedId = $state("");
	let cacheDiverged = $derived(
		dashboard.data.some((row) => {
			const confirmed = remote.current?.opportunities.find((record) => record.id === row.id);
			return confirmed && (confirmed.revision !== row.revision || confirmed.updatedAt !== row.updatedAt);
		}),
	);

	async function move() {
		const id = page.url.searchParams.get("record") === "birch" ? "fictional-opportunity-birch" : "fictional-opportunity-cedar";
		const row = dashboard.data.find((record) => record.id === id);
		if (!row) return;
		pending = true;
		failure = "";
		movedId = row.id;
		try {
			await experiment.move(row.id, row.stage === "active-lead" ? "new-lead" : "active-lead").isPersisted.promise;
		} catch {
			failure = "Move rejected; tentative stage rolled back. Refresh before retrying.";
		} finally {
			pending = false;
		}
	}

	onMount(() => {
		hydrated = true;
	});
	onDestroy(() => {
		void Promise.all([registry.collection.cleanup(), dashboard.collection.cleanup()]).then(() => experiment.dispose());
	});
</script>

<h1>TanStack DB compatibility experiment</h1>
<p>Local fictional records only. No offline storage.</p>
<p data-testid="registry-count">Registry: {registry.data.length}</p>
<p data-testid="dashboard-count">Dashboard: {dashboard.data.length}</p>
<p data-testid="cache-diverged">Second cache diverged: {String(cacheDiverged)}</p>
<button class="control" onclick={move} disabled={!hydrated || pending}>Move experiment opportunity</button>
<p role="status">{pending ? "Pending" : failure || "Ready"}</p>
<p data-testid="draft">Recoverable opportunity: {movedId}</p>
<ul aria-label="Dashboard stage counts">
	{#each stages as stage (stage)}
		<li data-count-stage={stage}>{dashboard.data.filter((row) => row.stage === stage).length}</li>
	{/each}
</ul>
<ul aria-label="Registry names">
	{#each registry.data as row (row.id)}
		<li>{row.name}</li>
	{/each}
</ul>
<ul>
	{#each dashboard.data as row (row.id)}
		<li data-record={row.id} data-stage={row.stage} data-revision={row.revision}>{row.title}: {row.stage}</li>
	{/each}
</ul>

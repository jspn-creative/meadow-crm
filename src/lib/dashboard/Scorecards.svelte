<script lang="ts">
	import Scorecard from "./Scorecard.svelte";
	import { getWorkspace } from "#lib/crm.remote.js";
	import { stageLabels } from "#lib/pipeline/labels.js";
	let workspace = $derived(await getWorkspace({ archived: false }));
	const colors = ["info", "pending", "tour", "success"] as const;
</script>

<section data-widget style:--widget-order={0} aria-label="Pipeline summary" class="grid grid-cols-2 gap-5 overflow-visible @min-[38rem]/dashboard:grid-cols-4">
	{#each Object.entries(stageLabels) as [stage, label], index (stage)}
		{@const count = workspace.opportunities.filter((opportunity) => opportunity.stage === stage).length}
		<Scorecard {label} value={count} detail={`${count} ${count === 1 ? "opportunity" : "opportunities"}`} color={colors[index]} />
	{/each}
</section>

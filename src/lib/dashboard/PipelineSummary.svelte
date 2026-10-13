<script lang="ts">
	import Scorecard from "./Scorecard.svelte";
	import { stages, opportunities } from "#lib/shell/fixtures.js";
	const colors = ["info", "pending", "tour", "success"] as const;
</script>

<section data-widget style:--widget-order={0} aria-label="Pipeline summary" class="grid grid-cols-2 gap-3 @min-[38rem]/dashboard:grid-cols-4 @min-[52rem]/dashboard:gap-5">
	{#each stages as stage, index (stage)}
		{@const count = opportunities.filter((opportunity) => opportunity.stage === stage).length}
		<Scorecard label={stage} value={count} detail={`${count} ${count === 1 ? "opportunity" : "opportunities"}`} color={colors[index]} />
	{/each}
</section>

<script lang="ts">
	import PipelineSummary from "#lib/dashboard/PipelineSummary.svelte";
	import AttentionCard from "#lib/dashboard/AttentionCard.svelte";
	import TasksCard from "#lib/dashboard/TasksCard.svelte";
	import RecentActivity from "#lib/dashboard/RecentActivity.svelte";
	import UpcomingEvents from "#lib/dashboard/UpcomingEvents.svelte";
</script>

<svelte:head><title>Dashboard · Meadow Lane</title></svelte:head>

<div class="surface-content dashboard-content @container space-y-5 pt-2!">
	<PipelineSummary />
	<div class="grid items-start gap-5 @min-[52rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><AttentionCard /><TasksCard /></div>
	<div class="grid items-start gap-5 @min-[52rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><RecentActivity /><UpcomingEvents /></div>
</div>

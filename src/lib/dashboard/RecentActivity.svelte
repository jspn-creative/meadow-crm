<script lang="ts">
	import DashboardCard from "./DashboardCard.svelte";
	import ActivityList from "./ActivityList.svelte";
	let { order = 0 }: { order?: number } = $props();
</script>

<DashboardCard title="Recent activity" headingId="activity-heading" {order}>
	<svelte:boundary>
		<ActivityList />
		{#snippet pending()}<p class="text-muted text-sm" role="status">Loading recent activity…</p>{/snippet}
		{#snippet failed(error, reset)}<p class="text-urgent text-sm" role="alert">Recent activity could not be loaded.</p>
			<button type="button" class="text-action" onclick={reset}>Retry</button>{/snippet}
	</svelte:boundary>
</DashboardCard>

<script lang="ts">
	import DashboardCard from "./DashboardCard.svelte";
	import TaskManager from "#lib/tasks/TaskManager.svelte";
	let { order = 0 }: { order?: number } = $props();
</script>

<DashboardCard title="Today's Tasks" headingId="tasks-heading" {order}>
	<svelte:boundary>
		<TaskManager />{#snippet pending()}<p class="text-muted text-sm" role="status">Loading tasks…</p>{/snippet}{#snippet failed(error, reset)}<p class="text-urgent text-sm" role="alert">Tasks could not be loaded.</p>
			<button type="button" class="text-action" onclick={reset}>Retry</button>{/snippet}
	</svelte:boundary>
</DashboardCard>

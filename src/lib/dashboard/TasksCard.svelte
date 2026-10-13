<script lang="ts">
	import { tasks } from "#lib/shell/fixtures.js";
	import DashboardCard from "./DashboardCard.svelte";
	import TaskList from "#lib/tasks/TaskList.svelte";
	let { order = 0 }: { order?: number } = $props();
</script>

<DashboardCard title="Realtor tasks" headingId="tasks-heading" action={{ href: "/tasks", label: "View all" }} {order}>
	<TaskList items={tasks} />
</DashboardCard>

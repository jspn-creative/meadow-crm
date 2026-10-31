<script lang="ts">
	import Scorecard from "./Scorecard.svelte";
	import { getWorkspace } from "#lib/crm.remote.js";
	let workspace = $derived(await getWorkspace({ archived: false }));
	let businessToday = $derived(workspace.businessToday);
	let end = $derived(new Date(Date.parse(`${businessToday}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10));

	let clientsCount = $derived(workspace.clients.filter((client) => client.archivedAt === null).length);
	let todayTasksCount = $derived(workspace.tasks.filter((task) => !task.completedAt && task.date <= businessToday).length);
	let overdueCount = $derived(workspace.tasks.filter((task) => !task.completedAt && task.dueDate !== null && task.dueDate < businessToday).length);
	// Same inclusion and horizon as the existing Upcoming widget: incomplete tasks whose date or due date falls after today and within the next 14 days, in the business's timezone.
	let upcomingCount = $derived(workspace.tasks.filter((task) => !task.completedAt && ((task.date > businessToday && task.date <= end) || (task.dueDate && task.dueDate > businessToday && task.dueDate <= end))).length);
</script>

<section data-widget style:--widget-order={0} aria-label="Dashboard scorecards" class="grid grid-cols-2 gap-5 overflow-visible @min-[38rem]/dashboard:grid-cols-4">
	<Scorecard label="Clients" value={clientsCount} detail="Non-archived clients" href="/registry" color="info" />
	<Scorecard label="Today's Tasks" value={todayTasksCount} detail="Date has arrived" href="/" color="success" />
	<Scorecard label="Overdue tasks" value={overdueCount} detail="Past due date" href="/" color="pending" />
	<Scorecard label="Upcoming" value={upcomingCount} detail="Next 14 days" href="/" color="tour" />
</section>

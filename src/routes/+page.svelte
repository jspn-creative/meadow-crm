<script lang="ts">
	import Scorecards from "#lib/dashboard/Scorecards.svelte";
	import AttentionCard from "#lib/dashboard/AttentionCard.svelte";
	import TasksCard from "#lib/dashboard/TasksCard.svelte";
	import RecentActivity from "#lib/dashboard/RecentActivity.svelte";
	import UpcomingEvents from "#lib/dashboard/UpcomingEvents.svelte";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";

	// The content never scrolls itself; the ancestor main does. Drive the mask from that scroller so scrolled content fades into the panel background instead of the panel edges dissolving.
	const contentFade = overflowFade({
		axis: "y",
		scrollSource: (element) => element.closest<HTMLElement>("#workspace-main"),
	});
</script>

<svelte:head><title>Dashboard · Meadow Lane</title></svelte:head>

<div class="surface-content dashboard-content @container/dashboard space-y-5 pt-2!" {@attach contentFade}>
	<Scorecards />
	<div class="grid items-start gap-5 @min-[52rem]/dashboard:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><AttentionCard order={1} /><TasksCard order={2} /></div>
	<div class="grid items-start gap-5 @min-[52rem]/dashboard:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><RecentActivity order={3} /><UpcomingEvents order={4} /></div>
</div>

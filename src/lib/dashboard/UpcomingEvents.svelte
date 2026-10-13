<script lang="ts">
	import { CalendarDays } from "@lucide/svelte";
	import DashboardCard from "./DashboardCard.svelte";
	let { order = 0 }: { order?: number } = $props();
</script>

<DashboardCard title="Upcoming events" headingId="events-heading" description="Next 14 days" {order}>
	<div class="flex items-start gap-3 py-2">
		<span class="bg-info-soft text-info flex size-9 shrink-0 items-center justify-center rounded-full"><CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" /></span>
		<p class="max-w-64 text-sm leading-6">Nothing on the calendar for the next two weeks.</p>
	</div>
	<figure class="bg-canvas mt-4 rounded-xl p-4">
		<blockquote><p class="font-display text-xl leading-7 tracking-tight text-pretty">“There is more to life than increasing its speed.”</p></blockquote>
		<figcaption class="text-muted mt-3 text-xs">Mahatma Gandhi</figcaption>
	</figure>
</DashboardCard>

<script lang="ts">
	import { CalendarCheck } from "@lucide/svelte";
	import DashboardCard from "./DashboardCard.svelte";
	let { order = 0 }: { order?: number } = $props();
</script>

<DashboardCard title="Upcoming events" headingId="events-heading" description="Next 14 days" descriptionInline {order}>
	<div class="flex flex-col items-center gap-(--card-gap) pt-2 pb-1 text-center">
		<div class="flex flex-col items-center gap-(--card-gap) py-4">
			<span class="bg-paper text-muted/60 rounded-full p-4"><CalendarCheck size={40} strokeWidth={1} aria-hidden="true" /></span>
			<p class="text-muted max-w-60 text-sm leading-6 text-balance">Nothing on the calendar for the next two weeks.</p>
		</div>
		<figure class="border-hairline w-full border-t pt-(--card-gap) opacity-75">
			<blockquote><p class="font-display mx-auto max-w-80 text-xl leading-7 tracking-tight text-balance">“There is more to life than increasing its speed.”</p></blockquote>
			<figcaption class="text-muted mt-2 text-sm leading-6">Mahatma Gandhi</figcaption>
		</figure>
	</div>
</DashboardCard>

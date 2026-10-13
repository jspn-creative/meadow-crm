<script lang="ts">
	import { CalendarCheck } from "@lucide/svelte";
	import DashboardCard from "./DashboardCard.svelte";
	let { order = 0 }: { order?: number } = $props();
</script>

<DashboardCard title="Upcoming events" headingId="events-heading" description="Next 14 days" descriptionInline {order}>
	<div class="px-1 pb-2 text-center @min-[24rem]/card:px-0 @min-[24rem]/card:pb-1">
		<div class="flex flex-col items-center gap-4 py-7">
			<CalendarCheck class="text-info" size={40} strokeWidth={1} aria-hidden="true" />
			<p class="text-muted max-w-60 text-sm leading-6 text-balance">Nothing on the calendar for the next two weeks.</p>
		</div>
		<figure class="border-hairline border-t pt-5">
			<blockquote><p class="font-display mx-auto max-w-80 text-2xl leading-8 tracking-tight text-balance">“There is more to life than increasing its speed.”</p></blockquote>
			<figcaption class="text-muted mt-3 text-xs leading-5">Mahatma Gandhi</figcaption>
		</figure>
	</div>
</DashboardCard>

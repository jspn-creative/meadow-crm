<script lang="ts">
	import { CalendarDays } from "@lucide/svelte";
</script>

<section class="border-hairline min-w-0 rounded-2xl border bg-white" aria-labelledby="events-heading">
	<div class="flex min-h-18 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-4 pb-3">
		<h2 id="events-heading" class="font-display text-xl tracking-tight">Upcoming events</h2>
		<span class="text-muted text-xs whitespace-nowrap">Next 14 days</span>
	</div>
	<div class="px-5 pb-5">
		<div class="flex items-start gap-3 py-2">
			<span class="bg-info-soft text-info flex size-9 shrink-0 items-center justify-center rounded-full"><CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" /></span>
			<p class="max-w-64 text-sm leading-6">Nothing on the calendar for the next two weeks.</p>
		</div>
		<figure class="bg-canvas mt-5 rounded-xl px-5 py-6">
			<blockquote><p class="font-display text-2xl leading-8 tracking-tight text-pretty">“There is more to life than increasing its speed.”</p></blockquote>
			<figcaption class="text-muted mt-4 text-xs">Mahatma Gandhi</figcaption>
		</figure>
	</div>
</section>

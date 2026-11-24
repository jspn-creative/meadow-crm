<script lang="ts">
	import type { ComponentProps } from "svelte";
	import { ArrowLeft } from "@lucide/svelte";
	import LogContactForm from "./LogContactForm.svelte";
	import type { SubPanel } from "./sub-panel.svelte.js";

	let {
		panel,
		back,
		headingId,
		...form
	}: {
		/** The sub-panel this pane fills; Back and Cancel step out of it. */
		panel: SubPanel<unknown>;
		/** The record Back returns to. */
		back: string;
		headingId: string;
	} & Omit<ComponentProps<typeof LogContactForm>, "oncancel"> = $props();
</script>

<div class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain px-(--gutter) pt-4 pb-6">
	<button type="button" class="text-action max-w-full" onclick={() => panel.close()}><ArrowLeft size={14} aria-hidden="true" /><span class="truncate">{back}</span></button>
	<h2 bind:this={panel.heading} id={headingId} tabindex="-1" class="font-display mt-3 mb-5 text-2xl tracking-tight outline-none">Log contact with {form.client}</h2>
	{#key panel.key}<LogContactForm {...form} oncancel={() => panel.close()} />{/key}
</div>

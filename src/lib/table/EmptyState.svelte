<!-- Adapted from SV Table's Empty State (https://sv-table.vercel.app/components/data-table-empty): a plain block instead of a full-width table row, styled with Meadow tokens instead of shadcn's Empty primitives. -->
<script lang="ts">
	import { SearchX } from "@lucide/svelte";
	import type { Snippet } from "svelte";

	type Props = {
		title?: string;
		description?: string;
		icon?: Snippet;
		actions?: Snippet;
		class?: string;
	};

	let { title = "No results found", description = "There is nothing to show.", icon, actions, class: className }: Props = $props();
</script>

<div class={["border-hairline flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center", className]}>
	<span class="bg-paper text-muted flex size-11 items-center justify-center rounded-full" aria-hidden="true">
		{#if icon}{@render icon()}{:else}<SearchX size={20} strokeWidth={1.4} />{/if}
	</span>
	<p class="font-display mt-4 text-xl">{title}</p>
	{#if description}<p class="text-muted mt-1 max-w-sm text-sm text-pretty">{description}</p>{/if}
	{#if actions}<div class="mt-5">{@render actions()}</div>{/if}
</div>

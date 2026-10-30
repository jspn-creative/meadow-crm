<script lang="ts">
	import { Check, Link } from "@lucide/svelte";

	let { id, term, class: className = "" }: { id: string; term: string; class?: string } = $props();
	let copied = $state(false);
	let reset: ReturnType<typeof setTimeout> | undefined;
	async function copy() {
		const url = new URL(location.href);
		url.search = "";
		url.hash = `term-${id}`;
		try {
			await navigator.clipboard.writeText(url.href);
			copied = true;
			clearTimeout(reset);
			reset = setTimeout(() => (copied = false), 1800);
		} catch {
			location.hash = `term-${id}`;
		}
	}
</script>

<button type="button" class={["control", className]} data-variant="ghost" data-size="sm" data-icon aria-label={copied ? `Link to ${term} copied` : `Copy link to ${term}`} onclick={copy}>
	{#if copied}<Check size={14} aria-hidden="true" />{:else}<Link size={14} aria-hidden="true" />{/if}
</button>

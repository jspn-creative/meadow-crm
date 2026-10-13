<script lang="ts">
	import { page } from "$app/state";
	import { afterNavigate } from "$app/navigation";
	import { onMount } from "svelte";
	import { LogIn, Settings2 } from "@lucide/svelte";
	let { compact = false }: { compact?: boolean } = $props();
	let open = $state(false);
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	afterNavigate(() => {
		open = false;
	});
	let root: HTMLDivElement;
</script>

<svelte:window
	onpointerdown={(event) => {
		if (root && !root.contains(event.target as Node)) open = false;
	}}
	onkeydown={(event) => {
		if (event.key === "Escape") open = false;
	}} />

<div bind:this={root} class="user-chip" data-open={open} data-compact={compact}>
	<button type="button" class="border-hairline flex min-h-11 w-full items-center gap-2.5 rounded-full border bg-white/70 p-1.5 text-left transition-colors hover:bg-white" disabled={!ready} aria-label="Workspace account" aria-expanded={open} onclick={() => (open = !open)}>
		<span class="bg-success-soft text-success flex size-8 shrink-0 items-center justify-center rounded-full"><span class="text-xs font-semibold" aria-hidden="true">ML</span></span>
		<span class="account-label min-w-0"><span class="block truncate text-xs font-medium">Meadow Lane</span><span class="text-2xs text-muted block">Shared workspace</span></span>
	</button>
	<div class="account-menu border-hairline shadow-panel rounded-xl border bg-white p-2">
		<a href="/settings" class="text-muted hover:bg-paper hover:text-ink flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors"><Settings2 size={16} aria-hidden="true" />Settings</a>
		<a href={`/login?next=${encodeURIComponent(page.url.pathname)}`} class="text-muted hover:bg-paper hover:text-ink flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors"><LogIn size={16} aria-hidden="true" />Demo login</a>
	</div>
</div>

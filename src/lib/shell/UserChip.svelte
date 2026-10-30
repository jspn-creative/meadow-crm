<script lang="ts">
	import { page } from "$app/state";
	import { afterNavigate } from "$app/navigation";
	import { onMount } from "svelte";
	import { BookOpen, LogIn, Settings2 } from "@lucide/svelte";
	import { themes, chooseTheme } from "./themes.js";
	let theme = $state("pop");
	let { compact = false }: { compact?: boolean } = $props();
	let open = $state(false);
	let ready = $state(false);
	onMount(() => {
		ready = true;
		const root = document.documentElement;
		const sync = () => {
			theme = root.dataset.theme ?? "pop";
		};
		sync();
		const observer = new MutationObserver(sync);
		observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
		return () => observer.disconnect();
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
	<button type="button" class="control w-full justify-start text-left" disabled={!ready} aria-label="Workspace account" aria-expanded={open} onclick={() => (open = !open)}>
		<span class="bg-success-soft text-success flex size-8 shrink-0 items-center justify-center rounded-full"><span class="text-xs font-semibold" aria-hidden="true">ML</span></span>
		<span class="account-label min-w-0"><span class="block truncate text-xs font-medium">Meadow Lane</span><span class="text-2xs text-muted block">Shared workspace</span></span>
	</button>
	<div class="account-menu surface surface-floating menu max-h-[70dvh] overflow-y-auto" inert={!open}>
		<a href="/settings" class="menu-item"><Settings2 size={16} aria-hidden="true" />Settings</a>
		<a href="/glossary" class="menu-item"><BookOpen size={16} aria-hidden="true" />Glossary</a>
		<fieldset class="border-hairline my-2 border-y py-2">
			<legend class="text-muted px-2 text-xs">Theme</legend>
			{#each themes as option (option.id)}
				<label class="menu-item cursor-pointer"><input class="radio" type="radio" name={compact ? "theme-compact" : "theme-rail"} value={option.id} checked={theme === option.id} onchange={() => chooseTheme(option.id)} />{option.label}</label>
			{/each}
		</fieldset>
		<a href={`/login?next=${encodeURIComponent(page.url.pathname)}`} class="menu-item"><LogIn size={16} aria-hidden="true" />Demo login</a>
	</div>
</div>

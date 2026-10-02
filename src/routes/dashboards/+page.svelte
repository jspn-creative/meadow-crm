<script lang="ts">
	import type { Dashboard } from "../../lib/dashboards.server";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	let open = $state<Dashboard | null>(null);
	let returnFocusTo: HTMLElement | null = null;

	$effect(() => {
		document.body.style.overflow = open ? "hidden" : "";

		return () => {
			document.body.style.overflow = "";
		};
	});

	function autofocus(node: HTMLElement) {
		node.focus();
	}

	function show(dashboard: Dashboard) {
		returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		open = dashboard;
	}

	function close() {
		open = null;
		returnFocusTo?.focus();
	}

	function oncard(event: MouseEvent, dashboard: Dashboard) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		show(dashboard);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && open) close();
	}
</script>

<svelte:head>
	<title>Dashboards · Meadow CRM</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<svelte:window {onkeydown} />

<div class="gallery min-h-dvh text-stone-900">
	<main class="mx-auto max-w-7xl px-6 py-12">
		<header class="pb-6">
			<p class="text-xs font-semibold tracking-widest text-stone-400 uppercase">Meadow Lane CRM</p>
			<h1 class="mt-2 font-serif text-4xl tracking-tight">Dashboards</h1>
		</header>

		<ul class="grid gap-8 sm:grid-cols-2">
			{#each data.dashboards as dashboard (dashboard.file)}
				<li>
					<a href={dashboard.href} onclick={(event) => oncard(event, dashboard)} class="group block">
						<div class="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 transition group-hover:border-stone-400">
							<div class="thumb">
								<iframe src={dashboard.href} loading="lazy" tabindex="-1" aria-hidden="true" title=""></iframe>
							</div>
							<span class="absolute right-3 bottom-3 rounded-lg bg-stone-900/85 px-2.5 py-1.5 text-xs font-semibold text-white/90 opacity-0 transition group-hover:opacity-100">Open</span>
						</div>
						<div class="mt-3 flex items-baseline gap-3">
							<span class="font-mono text-xs text-stone-400">{dashboard.num}</span>
							<h2 class="font-serif text-xl text-stone-600 transition group-hover:text-stone-900">
								{dashboard.name}
							</h2>
							<span class="ml-auto font-mono text-xs whitespace-nowrap text-stone-300">
								{dashboard.file}
							</span>
						</div>
					</a>
				</li>
			{:else}
				<li class="text-sm text-stone-500">No dashboards yet.</li>
			{/each}
		</ul>

		<footer class="mt-14 border-t border-stone-200 pt-6 text-xs leading-relaxed text-stone-500">
			<p class="text-pretty">
				Drop an HTML file into <code class="font-mono text-stone-700">static/dashboards/</code> and reload. It is picked up here automatically, named after its own
				<code class="font-mono">&lt;title&gt;</code>.
			</p>
		</footer>
	</main>

	{#if open}
		<div class="fixed inset-0 z-50 flex flex-col bg-stone-900/95" role="dialog" aria-modal="true" aria-labelledby="lightbox-title" tabindex="-1">
			<div class="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-3">
				<div class="flex min-w-0 items-baseline gap-3">
					<span class="font-mono text-xs text-white/40">{open.num}</span>
					<h2 id="lightbox-title" class="truncate font-serif text-lg text-stone-100">
						{open.name}
					</h2>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<a href={open.href} target="_blank" rel="noopener" class="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/40 hover:text-white">New tab</a>
					<button {@attach autofocus} type="button" class="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/40 hover:text-white" onclick={close}>Close</button>
				</div>
			</div>
			<div class="min-h-0 flex-1 bg-white">
				<iframe src={open.href} title={open.name} class="h-full w-full"></iframe>
			</div>
		</div>
	{/if}
</div>

<style>
	.gallery {
		--font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
		--font-serif: "Instrument Serif", Georgia, serif;
		font-family: var(--font-sans);
		background-color: #fbfbf9;
	}

	.thumb {
		container-type: inline-size;
		position: relative;
		aspect-ratio: 16 / 10;
		overflow: hidden;

		> iframe {
			position: absolute;
			inset: 0;
			width: 1440px;
			height: 900px;
			transform: scale(calc(100cqw / 1440px));
			transform-origin: top left;
			pointer-events: none;
		}
	}
</style>

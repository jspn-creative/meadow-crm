<script lang="ts">
	import "./layout.css";
	import favicon from "#lib/assets/favicon.svg";
	import { page } from "$app/state";
	import { onNavigate, afterNavigate } from "$app/navigation";
	import { dev } from "$app/env";
	import { PanelLeftClose, PanelLeftOpen } from "@lucide/svelte";
	import { destinations } from "#lib/shell/navigation.js";
	import Motif from "#lib/shell/Motif.svelte";
	import UserChip from "#lib/shell/UserChip.svelte";
	import VariantHost from "#lib/dev/VariantHost.svelte";
	import { motion, MotionConfig } from "@humanspeak/svelte-motion";
	import { MediaQuery } from "svelte/reactivity";
	import { onMount } from "svelte";

	let { children } = $props();
	let collapsed = $state(false);
	let ready = $state(false);
	let mobileScrolled = $state(false);
	let isLogin = $derived(page.url.pathname === "/login");
	let current = $derived(destinations.find((destination) => destination.href === page.url.pathname));
	let title = $derived(current?.label ?? { "/settings": "Settings", "/glossary": "Glossary" }[page.url.pathname as "/settings" | "/glossary"] ?? "Workspace");
	let transition: ViewTransition | undefined;
	const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	const desktop = new MediaQuery("(min-width: 64rem)");
	let sidebarCollapsed = $derived(desktop.current && collapsed);
	let greetingHidden = $derived(desktop.current ? collapsed : mobileScrolled);
	onMount(() => {
		ready = true;
	});
	afterNavigate(({ from, to }) => {
		if (from && to && from.url.href !== to.url.href) {
			document.getElementById("workspace-main")?.scrollTo({ top: 0, behavior: "instant" });
			mobileScrolled = false;
		}
	});

	onNavigate((navigation) => {
		if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		transition?.skipTransition();
		return new Promise<void>((resolve) => {
			let released = false;
			const release = () => {
				if (!released) {
					released = true;
					resolve();
				}
			};
			const timeout = window.setTimeout(release, 180);
			transition = document.startViewTransition(async () => {
				window.clearTimeout(timeout);
				release();
				// Release Kit before waiting for readiness; bound slow or failed navigation.
				await Promise.race([navigation.complete.catch(() => {}), new Promise<void>((done) => window.setTimeout(done, 700))]);
			});
			transition.ready.catch(release);
			transition.finished.catch(release).finally(() => window.clearTimeout(timeout));
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet" />
</svelte:head>

{#if !dev}
	<main class="mx-auto max-w-lg p-8">
		<h1 class="font-display text-3xl">Meadow Lane preview</h1>
		<p class="text-muted mt-4">This fictional workspace is available only in local development. Real login and shared records are not implemented yet.</p>
	</main>
{:else}
	<a href="#workspace-main" class="control fixed top-3 left-3 z-50 -translate-y-24 focus:translate-y-0">Skip to content</a>
	<div class="workspace" data-login={isLogin} data-collapsed={!isLogin && sidebarCollapsed}>
		<Motif />
		<aside class="rail" aria-label={isLogin ? "Meadow Lane" : "Workspace navigation"}>
			<div class="flex shrink-0 items-center justify-between gap-2">
				<a href="/" aria-label="Meadow Lane dashboard" class="flex min-h-11 min-w-0 items-center gap-2.5 whitespace-nowrap">
					<span class="bg-ink size-5 shrink-0 rounded-md" aria-hidden="true"></span>
					<span class="brand-label font-display truncate text-base tracking-tight">Meadow Lane</span>
				</a>
				{#if !isLogin}
					<div class="flex items-center gap-2 pr-8 lg:hidden">
						<UserChip compact />
					</div>
				{/if}
			</div>
			{#if isLogin}
				<div class="my-auto hidden max-w-sm py-12 lg:block">
					<h1 class="font-display text-5xl leading-tight tracking-tight text-balance">A little clarity for the work ahead.</h1>
					<p class="text-muted mt-5 max-w-xs">Clients, opportunities, and the next step. Together in one shared workspace.</p>
				</div>
			{:else}
				<MotionConfig reducedMotion="user" skipAnimations={reducedMotion.current}>
					<motion.div initial={false} animate={{ height: greetingHidden ? 0 : "auto", opacity: greetingHidden ? 0 : 1 }} transition={{ type: "tween", duration: 0.36, ease: [0.23, 1, 0.32, 1] }} class="rail-greeting shrink-0 overflow-hidden" inert={greetingHidden}>
						<p class="font-display mt-4 text-2xl/[1.08] tracking-tight text-balance sm:mt-8 sm:text-3xl/[1.08] lg:mt-10 lg:w-52">Good morning,<br class="hidden lg:block" /> Meadow Lane.</p>
					</motion.div>
				</MotionConfig>
				<nav
					id="workspace-nav"
					aria-label="Sections"
					class={["-mx-6 flex shrink-0 gap-2 overflow-x-auto px-6 transition-[margin-top] duration-360 ease-(--ease-shell) motion-reduce:transition-none lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0", !desktop.current && mobileScrolled ? "mt-2 sm:mt-4" : "mt-4 sm:mt-8"]}>
					{#each destinations as destination (destination.href)}
						<a
							href={destination.href}
							aria-current={page.url.pathname === destination.href ? "page" : undefined}
							aria-label={destination.label}
							title={sidebarCollapsed ? destination.label : undefined}
							class={["nav-destination hover:bg-paper-pill hover:text-ink aria-[current=page]:bg-paper-pill aria-[current=page]:text-ink flex min-h-10 shrink-0 items-center gap-3 rounded-full px-4 py-1.5 font-medium whitespace-nowrap", page.url.pathname === destination.href ? "text-ink" : "text-muted"]}>
							<destination.icon size={17} strokeWidth={1.8} class="shrink-0" aria-hidden="true" />
							<span class="nav-label">{destination.label}</span>
						</a>
					{/each}
				</nav>
				<div class="mt-auto hidden shrink-0 pt-8 lg:block">
					<button type="button" class="control rail-collapse w-full" data-icon={collapsed || undefined} disabled={!ready} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="workspace-nav" onclick={() => (collapsed = !collapsed)}>
						{#if collapsed}<PanelLeftOpen size={18} aria-hidden="true" />{:else}<PanelLeftClose size={18} aria-hidden="true" /><span>Collapse sidebar</span>{/if}
					</button>
					<div class="mt-4"><UserChip /></div>
				</div>
			{/if}
		</aside>
		<main
			id="workspace-main"
			tabindex="-1"
			class="main-surface"
			onscroll={(event) => {
				const { scrollTop } = event.currentTarget;
				if (scrollTop > 24) mobileScrolled = true;
				else if (scrollTop <= 0) mobileScrolled = false;
			}}>
			{#if !isLogin}
				<header class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-8 sm:pt-8 sm:pb-6 lg:px-10">
					<h1 class="workspace-title font-display text-2xl tracking-tight text-balance sm:text-3xl">
						{title}{#if page.url.pathname === "/"}
							<span class="text-muted ml-1">/ Overview</span>{/if}
					</h1>
				</header>
			{/if}
			{@render children()}
		</main>
	</div>
{/if}
<VariantHost />

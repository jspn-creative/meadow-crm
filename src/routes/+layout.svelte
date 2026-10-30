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
	import ImpersonationIndicator from "#lib/shell/ImpersonationIndicator.svelte";
	import { identityChangeKey, replaceSession } from "#lib/shell/session-navigation.js";
	import BookmarkStack from "#lib/bookmarks/BookmarkStack.svelte";
	import PipelineView from "#lib/pipeline/PipelineView.svelte";
	import VariantHost from "#lib/dev/VariantHost.svelte";
	import { variantSetting } from "#lib/dev/variants.svelte.js";
	import { guide, guideSections } from "./style-guide/guide.svelte.js";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import { motion, MotionConfig } from "@humanspeak/svelte-motion";
	import { MediaQuery } from "svelte/reactivity";
	import { onMount } from "svelte";

	let { children, data } = $props();
	async function verifySupportSession() {
		const expected = data.support?.sessionId;
		if (!expected) return;
		try {
			const response = await fetch("/api/auth/get-session", { cache: "no-store" });
			const current = response.ok ? await response.json() : null;
			if (data.support?.sessionId === expected && current?.session?.id !== expected) window.location.replace("/support");
		} catch {
			window.location.replace("/support");
		}
	}
	$effect(() => {
		if (!data.support?.expiresAt) return;
		const timeout = window.setTimeout(() => replaceSession("/support"), Math.max(0, data.support.expiresAt - Date.now()));
		return () => window.clearTimeout(timeout);
	});
	const material = variantSetting("material", ["Glass", "Tactile"], { label: "Material" });
	$effect(() => {
		if (dev) document.documentElement.dataset.material = material.value.toLowerCase();
	});
	let collapsed = $state(false);
	let ready = $state(false);
	let mobileScrolled = $state(false);
	let bookmarkedOpportunity = $state<{ id: string } | null>(null);
	function openOpportunity(id: string) {
		// Each click is a fresh request, even when reopening the same opportunity.
		bookmarkedOpportunity = { id };
	}
	let isLogin = $derived(page.url.pathname === "/login");
	// The development-only style guide borrows the rail for its own sections.
	let isGuide = $derived(dev && page.url.pathname === "/style-guide");
	// A module's nested views, such as archived opportunities, still belong to that module's sidebar item.
	let current = $derived(destinations.find((destination) => destination.href === page.url.pathname || (destination.href !== "/" && page.url.pathname.startsWith(`${destination.href}/`))));
	let title = $derived(current?.label ?? { "/settings": "Settings", "/glossary": "Glossary", "/style-guide": "Style guide" }[page.url.pathname as "/settings" | "/glossary" | "/style-guide"] ?? "Workspace");
	let transition: ViewTransition | undefined;
	const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	const desktop = new MediaQuery("(min-width: 64rem)");
	let sidebarCollapsed = $derived(desktop.current && collapsed);
	// The nav scrolls sideways below desktop, and vertically on desktop only for the style guide's longer list; the app's desktop nav never scrolls, so it skips the mask that would clip its focus rings.
	const navFadeX = overflowFade({ axis: "x", fadePercent: 12 });
	const navFadeY = overflowFade({ axis: "y", fadePercent: 12 });
	let navFade = $derived(desktop.current ? (isGuide ? navFadeY : null) : navFadeX);
	let greetingHidden = $derived(desktop.current ? collapsed : mobileScrolled);
	onMount(() => {
		ready = true;
		// Catch identity changes that happened before this document finished hydrating and attached its storage listener.
		void verifySupportSession();
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
</svelte:head>

<svelte:window
	onstorage={(event) => {
		if (event.key === identityChangeKey) window.location.reload();
	}}
	onpageshow={(event) => {
		if (event.persisted) window.location.reload();
	}}
	onfocus={() => {
		if (data.support?.expiresAt && data.support.expiresAt <= Date.now()) replaceSession("/support");
		else void verifySupportSession();
	}} />

{#if page.url.pathname === "/support"}
	{@render children()}
{:else}
	<a href="#workspace-main" class="control fixed top-3 left-3 z-50 -translate-y-24 focus:translate-y-0">Skip to content</a>
	<div class="workspace" data-login={isLogin} data-collapsed={!isLogin && sidebarCollapsed}>
		<Motif />
		<aside class="rail" aria-label={isLogin ? "Meadow Lane" : "Workspace navigation"}>
			<div class="flex shrink-0 items-center justify-between gap-2">
				<a href="/" aria-label="Meadow Lane dashboard" class="brand flex min-h-11 min-w-0 items-center gap-2.5 whitespace-nowrap">
					<span class="bg-ink size-5 shrink-0 rounded-md" aria-hidden="true"></span>
					<span class="brand-label font-display truncate text-base tracking-tight">Meadow Lane</span>
				</a>
				{#if !isLogin}
					<div class="flex items-center gap-2 pr-8 lg:hidden">
						<BookmarkStack variant="compact" {openOpportunity} />
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
				{#snippet navLink(href: string, label: string, Icon: (typeof destinations)[number]["icon"], state: "page" | "true" | undefined, onclick?: (event: MouseEvent) => void)}
					<a
						{href}
						aria-current={state}
						aria-label={label}
						title={sidebarCollapsed ? label : undefined}
						{onclick}
						class={[
							"nav-destination hover:bg-highlight hover:text-ink aria-[current=page]:bg-selected aria-[current=page]:text-on-selected aria-[current=true]:bg-selected aria-[current=true]:text-on-selected flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 py-1.5 font-medium whitespace-nowrap",
							state ? "text-ink" : "text-muted",
						]}>
						<Icon size={17} strokeWidth={1.8} class="shrink-0" aria-hidden="true" />
						<span class="nav-label">{label}</span>
					</a>
				{/snippet}
				<nav
					id="workspace-nav"
					aria-label={isGuide ? "Style guide sections" : "Sections"}
					{@attach navFade}
					class={[
						// Below lg the row scrolls sideways, so its vertical padding (offset by the margins) keeps focus glows from being clipped.
						"-mx-6 flex shrink-0 gap-2 overflow-x-auto px-6 transition-[margin-top] duration-360 ease-(--ease-shell) motion-reduce:transition-none max-lg:-mb-1.5 max-lg:py-1.5 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0",
						!desktop.current && mobileScrolled ? "mt-0.5 sm:mt-2.5" : "mt-2.5 sm:mt-6.5 lg:mt-8",
						// The style guide lists more sections than the app has modules, so on short viewports they scroll instead of pushing the account chip away.
						isGuide && "lg:-mx-1 lg:min-h-0 lg:shrink lg:overflow-y-auto lg:px-1 lg:py-1",
					]}>
					{#if isGuide}
						{#each guideSections as section (section.id)}
							{@render navLink(`#${section.id}`, section.label, section.icon, guide.active === section.id ? "true" : undefined, (event) => {
								event.preventDefault();
								void guide.reveal(section.id);
							})}
						{/each}
					{:else}
						{#each destinations as destination (destination.href)}
							{@render navLink(destination.href, destination.label, destination.icon, current === destination ? (page.url.pathname === destination.href ? "page" : "true") : undefined)}
						{/each}
					{/if}
				</nav>
				<div class="mt-auto hidden shrink-0 pt-8 lg:block">
					<BookmarkStack variant="rail" {openOpportunity} />
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
			{#if data.support?.effectiveUser}<ImpersonationIndicator role={data.support.effectiveUser} />{/if}
			{#if !isLogin}
				<header class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-8 sm:pt-8 sm:pb-6 lg:px-10">
					<h1 class="workspace-title font-display text-2xl tracking-tight text-balance sm:text-3xl">
						{title}{#if page.url.pathname === "/"}
							<span class="text-muted ml-1">/ Overview</span>{:else if page.url.pathname === "/pipeline/archived"}
							<span class="text-muted ml-1">/ Archived</span>{/if}
					</h1>
				</header>
			{/if}
			{@render children()}
		</main>
	</div>
	{#if bookmarkedOpportunity && !isLogin}
		{@const request = bookmarkedOpportunity}
		{#key bookmarkedOpportunity}
			<PipelineView
				opportunity={request.id}
				dialogOnly
				onclose={() => {
					if (bookmarkedOpportunity === request) bookmarkedOpportunity = null;
				}} />
		{/key}
	{/if}
	<VariantHost />
{/if}

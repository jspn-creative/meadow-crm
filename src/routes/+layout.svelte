<script lang="ts">
	import "./layout.css";
	import favicon from "#lib/assets/favicon.svg";
	import { page } from "$app/state";
	import { onNavigate, afterNavigate } from "$app/navigation";
	import { browser, dev } from "$app/env";
	import { PanelLeftClose, PanelLeftOpen } from "@lucide/svelte";
	import { destinations } from "#lib/shell/navigation.js";
	import Motif from "#lib/shell/Motif.svelte";
	import UserChip from "#lib/shell/UserChip.svelte";
	import { userFirstName } from "#lib/data/users.js";
	import { identityChangeKey, replaceSession } from "#lib/shell/session-navigation.js";
	import BookmarkStack from "#lib/bookmarks/BookmarkStack.svelte";
	import FeedbackTool from "#lib/feedback/FeedbackTool.svelte";
	import PipelineView from "#lib/pipeline/PipelineView.svelte";
	import VariantHost from "#lib/dev/VariantHost.svelte";
	import { variantSetting } from "#lib/dev/variants.svelte.js";
	import { guide, guideSections } from "./style-guide/guide.svelte.js";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import { motion, MotionConfig } from "@humanspeak/svelte-motion";
	import { MediaQuery } from "svelte/reactivity";
	import { onMount, tick } from "svelte";

	let { children, data } = $props();
	// Capture request state during component initialization on the server, before asynchronous children render. On the client this remains reactive across full navigations.
	const requestUrl = page.url;
	let routeUrl = $derived(browser ? page.url : requestUrl);
	async function verifySupportSession() {
		const expected = data.support?.sessionId;
		if (!expected) return;
		try {
			const response = await fetch("/api/auth/get-session", { cache: "no-store" });
			// An unavailable server is not proof of an identity change. Only a verified session mismatch should replace the workspace.
			if (!response.ok) {
				if (response.status === 401 || response.status === 403) replaceSession("/login");
				return;
			}
			const current = await response.json();
			if (data.support?.sessionId === expected && current?.session?.id !== expected) window.location.replace("/login");
		} catch {
			// Leave the current view intact on transient network failures; the server still verifies every read and write.
		}
	}
	$effect(() => {
		if (!data.support?.expiresAt) return;
		const timeout = window.setTimeout(() => replaceSession("/login"), Math.max(0, data.support.expiresAt - Date.now()));
		return () => window.clearTimeout(timeout);
	});
	const material = variantSetting("material", ["Tactile", "Glass"], { label: "Material" });
	$effect(() => {
		if (dev) document.documentElement.dataset.material = material.value.toLowerCase();
	});
	let collapsed = $state(false);
	let ready = $state(false);

	// Only explicit identity navigation may capture this document. Ordinary reloads and back/forward restores must not replay cached workspace screenshots.
	function onPageSwap(event: Event) {
		const swap = event as unknown as {
			viewTransition?: ViewTransition | null;
			activation?: { entry?: { url?: string } | null } | null;
		};
		const vt = swap?.viewTransition;
		if (!vt) return;
		// Chrome rejects the outgoing transition's ready promise when that document is hidden, even when the incoming animation succeeds.
		void vt.ready.catch(() => {});
		void vt.updateCallbackDone.catch(() => {});
		void vt.finished.catch(() => {});
		const marker = document.documentElement.dataset.sessionDestination;
		const authorized = !!marker;
		let targetMatches = false;
		if (authorized) {
			const url = swap.activation?.entry?.url;
			if (url) {
				try {
					const dest = new URL(url);
					targetMatches = dest.origin === location.origin && dest.pathname + dest.search + dest.hash === marker;
				} catch {
					targetMatches = false;
				}
			}
		}
		if (!authorized || !targetMatches) vt.skipTransition();
	}

	onMount(() => {
		ready = true;
		// Catch identity changes that happened before this document finished hydrating and attached its storage listener.
		void verifySupportSession();
		window.addEventListener("pageswap", onPageSwap);
		return () => window.removeEventListener("pageswap", onPageSwap);
	});
	let bookmarkedOpportunity = $state<{ id: string } | null>(null);
	function openOpportunity(id: string) {
		// Each click is a fresh request, even when reopening the same opportunity.
		bookmarkedOpportunity = { id };
	}
	let isLogin = $derived(routeUrl.pathname === "/login");
	// The development-only style guide borrows the rail for its own sections.
	let isGuide = $derived(dev && routeUrl.pathname === "/style-guide");
	// A module's nested views, such as archived opportunities, still belong to that module's sidebar item.
	let current = $derived(destinations.find((destination) => destination.href === routeUrl.pathname || (destination.href !== "/" && routeUrl.pathname.startsWith(`${destination.href}/`))));
	let title = $derived(current?.label ?? { "/settings": "Settings", "/glossary": "Glossary", "/style-guide": "Style guide" }[routeUrl.pathname as "/settings" | "/glossary" | "/style-guide"] ?? "Workspace");
	let transition: ViewTransition | undefined;
	const reducedMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
	const desktop = new MediaQuery("(min-width: 64rem)");
	let sidebarCollapsed = $derived(desktop.current && collapsed);
	let mobileScrolled = $state(false);
	// The nav scrolls sideways below desktop, and vertically on desktop only for the style guide's longer list; the app's desktop nav never scrolls, so it skips the mask that would clip its focus rings.
	const navFadeX = overflowFade({ axis: "x", fadePercent: 12 });
	const navFadeY = overflowFade({ axis: "y", fadePercent: 12 });
	const mainFade = overflowFade({ axis: "y", fadePercent: 4, scrollSource: (node) => node.closest("main") });
	let navFade = $derived(desktop.current ? (isGuide ? navFadeY : null) : navFadeX);
	let greetingHidden = $derived(desktop.current ? collapsed : mobileScrolled);
	// Shallow navigations change a view's own state, such as the Registry's filters, so they keep the scroll position and skip the shell transition.
	afterNavigate(({ from, to, shallow }) => {
		if (from && to && !shallow && from.url.href !== to.url.href) {
			document.getElementById("workspace-main")?.scrollTo({ top: 0, behavior: "instant" });
			mobileScrolled = false;
		}
	});

	onNavigate((navigation) => {
		if (!navigation.shallow) delete document.documentElement.dataset.loginEntry;
		if (navigation.shallow || !document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		transition?.skipTransition();
		return new Promise<void>((resolve) => {
			try {
				const currentTransition = document.startViewTransition(async () => {
					resolve();
					// Keep the old snapshot until Kit has committed the destination; a timer must not capture a half-rendered view.
					try {
						await navigation.complete;
						await tick();
					} catch {
						currentTransition.skipTransition();
					}
				});
				transition = currentTransition;
				currentTransition.ready.catch(resolve);
				currentTransition.finished.catch(resolve);
			} catch {
				resolve();
			}
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
		if (data.support?.expiresAt && data.support.expiresAt <= Date.now()) replaceSession("/login");
		else void verifySupportSession();
	}} />

{#if routeUrl.pathname === "/support"}
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
						<p class="font-display mt-4 text-2xl/[1.08] tracking-tight sm:mt-8 lg:mt-10 lg:w-52"><span class="whitespace-nowrap">Good morning,</span><br /> <span class="whitespace-nowrap">{data.identity ? userFirstName(data.identity.effectiveUserId) : "Meadow Lane"}.</span></p>
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
							{@render navLink(destination.href, destination.label, destination.icon, current === destination ? (routeUrl.pathname === destination.href ? "page" : "true") : undefined)}
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
			<div class="workspace-content" {@attach mainFade}>
				{#if !isLogin}
					<header class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-8 sm:pt-8 sm:pb-6 lg:px-10">
						<h1 class="workspace-title font-display text-2xl tracking-tight text-balance sm:text-3xl">
							{title}{#if routeUrl.pathname === "/"}
								<span class="text-muted ml-1">/ Overview</span>{:else if routeUrl.pathname === "/pipeline/archived"}
								<span class="text-muted ml-1">/ Archived</span>{/if}
						</h1>
					</header>
				{/if}
				{#key routeUrl.pathname}
					<svelte:boundary>
						{@render children()}
						{#snippet failed(_error, reset)}
							<section class="surface-content" aria-labelledby="view-failure-heading">
								<h2 id="view-failure-heading" class="font-display text-2xl">This view couldn’t load.</h2>
								<p class="text-muted mt-2" role="alert">Please try again, or reload if the problem continues.</p>
								<div class="mt-4 flex flex-wrap gap-3"><button type="button" class="control" onclick={reset}>Try again</button><button type="button" class="control" onclick={() => window.location.reload()}>Reload</button></div>
							</section>
						{/snippet}
					</svelte:boundary>
				{/key}
			</div>
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
	{#if isGuide}<VariantHost />{/if}
	{#if data.identity && !isLogin}<FeedbackTool />{/if}
{/if}

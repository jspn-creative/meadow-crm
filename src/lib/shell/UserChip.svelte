<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { onMount, tick } from "svelte";
	import { page } from "$app/state";
	import { exitImpersonation, replaceSession } from "./session-navigation.js";
	import { BookOpen, Check, ChevronLeft, ChevronRight, LogOut, KeyRound, Settings2, UserRoundCog, UserRoundX } from "@lucide/svelte";
	import { chooseFont, chooseTheme, endPreview, fonts, preview, themes, type FontId, type ThemeId } from "./themes.js";
	const id = $props.id();
	let theme = $state("pop");
	let font = $state("bricolage");
	// A theme or font list slides over the menu's items. Hovering or focusing an option previews it across the app until one is chosen or the list is left.
	let list = $state<"theme" | "font" | null>(null);
	// The option drawn across the app. It carries the row's highlight, because while a preview's view transition runs, the browser sends pointer events to the document element rather than the rows, and hover state does not update.
	let previewing = $state<string | null>(null);
	function show(setting: "theme" | "font", value: string, from?: Origin) {
		previewing = value;
		preview(setting, value, from);
	}
	let triggers: Record<"theme" | "font", HTMLButtonElement | undefined> = $state({ theme: undefined, font: undefined });
	let panes: Record<"theme" | "font", HTMLDivElement | undefined> = $state({ theme: undefined, font: undefined });
	type Origin = { x: number; y: number };
	function centerOf(element: Element): Origin {
		const box = element.getBoundingClientRect();
		return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
	}
	// Going back slides the items in first and then restores the saved option from its button, because a view transition started mid-slide would freeze the slide behind its still image of the page.
	let restoring: { setting: "theme" | "font"; timer: number } | undefined;
	function restoreNow() {
		if (!restoring) return;
		window.clearTimeout(restoring.timer);
		const { setting } = restoring;
		restoring = undefined;
		endPreview(setting, setting === "theme" ? theme : font, triggers[setting] && centerOf(triggers[setting]));
	}
	async function showList(next: "theme" | "font") {
		restoreNow();
		list = next;
		await tick();
		panes[next]?.querySelector<HTMLElement>("[aria-current='true']")?.focus();
	}
	async function leaveList(restoreFocus = false, from?: Origin) {
		const current = list;
		if (!current) return;
		list = null;
		if (restoreFocus && !matchMedia("(prefers-reduced-motion: reduce)").matches) restoring = { setting: current, timer: window.setTimeout(restoreNow, 320) };
		else endPreview(current, current === "theme" ? theme : font, from);
		previewing = null;
		if (restoreFocus) {
			await tick();
			triggers[current]?.focus();
		}
	}
	function pickTheme(next: ThemeId) {
		chooseTheme(next);
		theme = next;
		void leaveList(true);
	}
	function pickFont(next: FontId) {
		chooseFont(next);
		font = next;
		void leaveList(true);
	}
	let menu = $state<HTMLDivElement>();
	const within = (element: Element | undefined, { x, y }: Origin) => {
		const box = element?.getBoundingClientRect();
		return !!box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
	};
	/** The open list's button under a point, found by geometry so it also works while a view transition retargets pointer events. */
	function buttonAt(point: Origin, selector = "button") {
		if (!list) return;
		return [...(panes[list]?.querySelectorAll<HTMLButtonElement>(selector) ?? [])].find((button) => within(button, point));
	}
	function closeMenu(from?: Origin) {
		open = false;
		restoreNow();
		void leaveList(false, from);
	}
	let { compact = false, accountOnly = false }: { compact?: boolean; accountOnly?: boolean } = $props();
	let open = $state(false);
	let ready = $state(false);
	let changingPassword = $state(false);
	let pending = $state(false);
	let message = $state("");
	// While impersonating, the chip shows who the support admin is acting as and offers an explicit exit.
	let impersonating = $derived(page.data.support?.effectiveUser as "realtor" | "assistant" | null | undefined);
	let roleLabel = $derived(impersonating === "realtor" ? "Realtor" : "Assistant");
	async function leaveImpersonation() {
		if (pending) return;
		pending = true;
		message = "";
		if (!(await exitImpersonation())) {
			message = "Unable to exit impersonation. Try again.";
			pending = false;
		}
	}
	async function logout() {
		pending = true;
		message = "";
		try {
			const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
			if (!response.ok) throw new Error();
			replaceSession("/login");
		} catch {
			message = "Unable to log out. Try again.";
			pending = false;
		}
	}
	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		message = "";
		const form = event.currentTarget as HTMLFormElement;
		const values = new FormData(form);
		try {
			const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: values.get("currentPassword"), newPassword: values.get("newPassword"), revokeOtherSessions: true }) });
			if (!response.ok) throw new Error();
			form.reset();
			changingPassword = false;
			message = "Password changed. Other sessions have been logged out.";
		} catch {
			message = "Unable to change password. Check your current password and try again.";
		} finally {
			pending = false;
		}
	}
	onMount(() => {
		ready = true;
		const root = document.documentElement;
		const sync = () => {
			if (root.dataset.themePreview === undefined) theme = root.dataset.theme ?? "pop";
			if (root.dataset.fontPreview === undefined) font = root.dataset.font ?? "bricolage";
		};
		sync();
		const observer = new MutationObserver(sync);
		observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-theme-preview", "data-font", "data-font-preview"] });
		return () => observer.disconnect();
	});
	afterNavigate(() => closeMenu());
	let root: HTMLDivElement;
</script>

<svelte:window
	onpointermove={(event) => {
		const option = buttonAt({ x: event.clientX, y: event.clientY }, "[data-value]");
		if (list && option && option.dataset.value !== previewing) show(list, option.dataset.value!, { x: event.clientX, y: event.clientY });
	}}
	onpointerdown={(event) => {
		// Decided by position, because during a preview's view transition the event's target is not the element under the pointer.
		const point = { x: event.clientX, y: event.clientY };
		if (open && !within(menu, point) && !within(root, point)) closeMenu(point);
	}}
	onclick={(event) => {
		// A click during a preview's view transition does not reach the menu, so pass it to the list's button underneath.
		if (!root?.contains(event.target as Node)) buttonAt({ x: event.clientX, y: event.clientY })?.click();
	}}
	onkeydown={(event) => {
		// Escape in a list returns to the menu's items first.
		if (event.key !== "Escape" || !open) return;
		if (list) void leaveList(true);
		else closeMenu();
	}} />

<div bind:this={root} class="user-chip" data-open={open} data-compact={compact}>
	<button type="button" class="control w-full justify-start text-left" disabled={!ready} aria-label="Workspace account" aria-expanded={open} onclick={() => (open ? closeMenu() : (open = true))}>
		{#if impersonating}
			<span class="bg-pending-soft text-pending ring-pending flex size-8 shrink-0 items-center justify-center rounded-full ring-2"><UserRoundCog size={16} aria-hidden="true" /></span>
			<span class="account-label min-w-0"><span class="block truncate text-xs font-medium">{roleLabel}</span><span class="text-2xs text-pending block truncate">via Support admin</span></span>
		{:else}
			<span class="bg-success-soft text-success flex size-8 shrink-0 items-center justify-center rounded-full"><span class="text-xs font-semibold" aria-hidden="true">ML</span></span>
			<span class="account-label min-w-0"><span class="block truncate text-xs font-medium">{accountOnly ? "Support admin" : "Meadow Lane"}</span><span class="text-2xs text-muted block">{accountOnly ? "Choose a business user" : "Shared workspace"}</span></span>
		{/if}
	</button>
	<div bind:this={menu} class="account-menu surface surface-floating menu max-h-[70dvh] overflow-y-auto" inert={!open}>
		<div class="menu-pane" data-active={!list} inert={!!list}>
			<button type="button" class="menu-item" disabled={pending} onclick={logout}><LogOut size={16} aria-hidden="true" />Log out</button>
			{#if !accountOnly}
				<a href="/settings" class="menu-item"><Settings2 size={16} aria-hidden="true" />Settings</a>
				<a href="/glossary" class="menu-item"><BookOpen size={16} aria-hidden="true" />Glossary</a>
			{/if}
			{#if impersonating}
				<div class="mt-2">
					{@render heading("Impersonation")}
					<button type="button" class="menu-item" disabled={pending} onclick={leaveImpersonation}><UserRoundX size={16} aria-hidden="true" />Exit impersonation</button>
				</div>
			{/if}
			{#if !accountOnly}
				<div class="my-2 grid gap-1.5 px-1 pb-2">
					{@render heading("Theme")}
					<span id={`${id}-theme-label`} class="sr-only">Theme</span>
					<button bind:this={triggers.theme} type="button" class="control w-full justify-start" data-size="sm" aria-labelledby={`${id}-theme-label ${id}-theme-value`} onclick={() => showList("theme")}>
						<span id={`${id}-theme-value`} class="min-w-0 flex-1 truncate text-left">{themes.find((option) => option.id === theme)?.label}</span>
						{@render colors(theme)}
						<ChevronRight size={14} class="text-muted shrink-0" aria-hidden="true" />
					</button>
					<span id={`${id}-font-label`} class="sr-only">Font</span>
					<button bind:this={triggers.font} type="button" class="control w-full justify-start" data-size="sm" aria-labelledby={`${id}-font-label ${id}-font-value`} onclick={() => showList("font")}>
						<span id={`${id}-font-value`} data-font={font} class="font-display min-w-0 flex-1 truncate text-left text-[0.9375rem]">{fonts.find((option) => option.id === font)?.label}</span>
						<ChevronRight size={14} class="text-muted shrink-0" aria-hidden="true" />
					</button>
				</div>
			{/if}
			{#if !page.data.support?.effectiveUser}
				<button
					type="button"
					class="menu-item"
					aria-expanded={changingPassword}
					onclick={() => {
						changingPassword = !changingPassword;
						message = "";
					}}><KeyRound size={16} aria-hidden="true" />Change password</button>
				{#if changingPassword}
					<form method="POST" class="grid gap-3 p-2" onsubmit={changePassword}>
						<label class="grid gap-1 text-xs">Current password<input class="field" name="currentPassword" type="password" autocomplete="current-password" required /></label>
						<label class="grid gap-1 text-xs">New password (8–128 characters)<input class="field" name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></label>
						<button class="control" data-variant="primary" disabled={pending}>Change password</button>
					</form>
				{/if}
			{/if}
			{#if message}<p role="status" class="text-muted p-2 text-xs">{message}</p>{/if}
		</div>
		{#if !accountOnly}
			<div bind:this={panes.theme} class="menu-pane" data-side="end" data-active={list === "theme"} inert={list !== "theme"} role="group" aria-label="Theme">
				{@render back()}
				{#each themes as option (option.id)}
					<button type="button" class="menu-item" aria-current={theme === option.id} data-value={option.id} data-active={previewing === option.id} onfocus={(event) => show("theme", option.id, centerOf(event.currentTarget))} onclick={() => pickTheme(option.id)}>
						<span class="min-w-0 flex-1 truncate">{option.label}</span>
						{@render colors(option.id)}
						{@render check(theme === option.id)}
					</button>
				{/each}
			</div>
			<div bind:this={panes.font} class="menu-pane" data-side="end" data-active={list === "font"} inert={list !== "font"} role="group" aria-label="Font">
				{@render back()}
				{#each fonts as option (option.id)}
					<button type="button" class="menu-item" aria-current={font === option.id} data-value={option.id} data-active={previewing === option.id} onfocus={() => show("font", option.id)} onclick={() => pickFont(option.id)}>
						<span data-font={option.id} class="grid min-w-0 flex-1">
							<span class="font-display truncate text-base/6">{option.label}</span>
							<span class="text-muted truncate font-sans text-xs font-normal">{option.display === option.body ? `${option.body} throughout` : `${option.body} for body text`}</span>
						</span>
						{@render check(font === option.id)}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#snippet heading(label: string)}
	<p class="text-muted flex items-center gap-3 px-2.5 py-1.5 text-xs leading-none">{label}<span class="menu-divider border-hairline h-px min-w-0 flex-1 border-t" aria-hidden="true"></span></p>
{/snippet}

{#snippet back()}
	<button type="button" class="menu-item text-muted mb-1" onclick={() => leaveList(true)}><ChevronLeft size={16} aria-hidden="true" />Back</button>
{/snippet}

{#snippet check(current: boolean)}
	<Check size={14} class={["shrink-0", !current && "invisible"]} aria-hidden="true" />
{/snippet}

<!-- Inside its data-theme scope a theme's own inputs apply, so these dots show that theme's colors whatever theme is active. Each dot after the first is cut away where it meets the one before, so the stack reads on any row background. -->
{#snippet colors(id: string)}
	<span data-theme={id} class="flex shrink-0" aria-hidden="true">
		{#each ["--theme-canvas", "--theme-primary", "--theme-sky", "--theme-amber", "--theme-violet"] as color (color)}
			<span class="size-3.5 rounded-full bg-(--dot) shadow-[inset_0_0_0_1px_oklch(0_0_0/0.1)] not-first:-ml-1 not-first:[mask-image:radial-gradient(circle_at_-3px_50%,transparent_8.5px,black_9px)]" style:--dot={`var(${color})`}></span>
		{/each}
	</span>
{/snippet}

<style>
	.menu-divider {
		@supports (border-shape: shape(from 0 50%, hline to 100%)) {
			border-top: 0;
			border-inline: 1px solid var(--color-hairline);
			border-shape: shape(from 0 50%, hline to 100%);
		}
	}
</style>

<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { replaceSession } from "./session-navigation.js";
	import { BookOpen, LogOut, KeyRound, Settings2 } from "@lucide/svelte";
	import { themes, chooseTheme } from "./themes.js";
	let theme = $state("pop");
	let { compact = false, accountOnly = false }: { compact?: boolean; accountOnly?: boolean } = $props();
	let open = $state(false);
	let ready = $state(false);
	let changingPassword = $state(false);
	let pending = $state(false);
	let message = $state("");
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
		<span class="account-label min-w-0"><span class="block truncate text-xs font-medium">{accountOnly ? "Support admin" : "Meadow Lane"}</span><span class="text-2xs text-muted block">{accountOnly ? "Choose a business user" : "Shared workspace"}</span></span>
	</button>
	<div class="account-menu surface surface-floating menu max-h-[70dvh] overflow-y-auto" inert={!open}>
		{#if !accountOnly}
			<a href="/settings" class="menu-item"><Settings2 size={16} aria-hidden="true" />Settings</a>
			<a href="/glossary" class="menu-item"><BookOpen size={16} aria-hidden="true" />Glossary</a>
			<fieldset class="border-hairline my-2 border-y py-2">
				<legend class="text-muted px-2 text-xs">Theme</legend>
				{#each themes as option (option.id)}
					<label class="menu-item cursor-pointer"><input class="radio" type="radio" name={compact ? "theme-compact" : "theme-rail"} value={option.id} checked={theme === option.id} onchange={() => chooseTheme(option.id)} />{option.label}</label>
				{/each}
			</fieldset>
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
					<label class="grid gap-1 text-xs">New password (12–128 characters)<input class="field" name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /></label>
					<button class="control" data-variant="primary" disabled={pending}>Change password</button>
				</form>
			{/if}
		{/if}
		<button type="button" class="menu-item" disabled={pending} onclick={logout}><LogOut size={16} aria-hidden="true" />Log out</button>
		{#if message}<p role="status" class="text-muted p-2 text-xs">{message}</p>{/if}
	</div>
</div>

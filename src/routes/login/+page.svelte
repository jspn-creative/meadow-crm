<script lang="ts">
	import { page } from "$app/state";
	import { invalidateAll } from "$app/navigation";
	import { ArrowRight } from "@lucide/svelte";
	import { onMount, tick } from "svelte";
	import UserChip from "#lib/shell/UserChip.svelte";
	import { notifyIdentityChange, replaceSession } from "#lib/shell/session-navigation.js";
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let pending = $state(false);
	let error = $state("");
	let panel: HTMLDivElement;
	let choosing = $derived(!!page.data.support);
	let opening = $state<string | null>(null);
	function destination() {
		const next = page.url.searchParams.get("next");
		if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
		const url = new URL(next, page.url.origin);
		return url.origin === page.url.origin && !["/login", "/support"].includes(url.pathname) && !url.pathname.startsWith("/api/") ? url.pathname + url.search + url.hash : "/";
	}
	async function enterWorkspace() {
		// Keep the source painted while loading. Fading it out before replacing the document leaves a blank interval on slower responses.
		replaceSession(destination());
	}
	async function showBusinessUsers(form: HTMLFormElement) {
		const update = async () => {
			await invalidateAll();
			form.reset();
			pending = false;
			await tick();
			panel.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
		};
		if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			const transition = document.startViewTransition(update);
			transition.ready.catch(() => {});
			transition.finished.catch(() => {});
			await transition.updateCallbackDone;
		} else await update();
	}
	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		error = "";
		const element = event.currentTarget as HTMLFormElement;
		const form = new FormData(element);
		let signedIn = false;
		try {
			const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
			if (!response.ok) throw new Error();
			signedIn = true;
			const result = await response.json();
			if (result.user?.role === "admin") {
				// The auth response only selects the UI flow; refreshed request-scoped support state and /api/support/choose remain the authority for impersonation.
				notifyIdentityChange();
				await showBusinessUsers(element);
				if (!choosing) throw new Error();
				return;
			}
			await enterWorkspace();
		} catch {
			error = signedIn ? "Signed in, but unable to open your workspace. Reload and try again." : "Unable to sign in. Check your email and password and try again.";
			pending = false;
		}
	}
	async function choose(userId: string) {
		if (pending) return;
		pending = true;
		opening = userId;
		error = "";
		try {
			const response = await fetch("/api/support/choose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
			if (!response.ok) throw new Error();
			await enterWorkspace();
		} catch {
			error = "Unable to impersonate that business user. Try again.";
			pending = false;
			opening = null;
		}
	}
</script>

<svelte:head><title>Login · Meadow Lane</title></svelte:head>

<div class="flex min-h-[calc(100dvh-6rem)] items-center justify-center px-5 py-12 sm:px-8 lg:min-h-[calc(100dvh-1.5rem)] lg:px-10">
	<div bind:this={panel} class="w-full max-w-sm [view-transition-name:login-panel]">
		{#if choosing}
			<section aria-labelledby="login-heading">
				<h2 id="login-heading" tabindex="-1" class="font-display text-4xl tracking-tight">Who are you helping?</h2>
				<p class="text-muted mt-3">Choose a business user to impersonate.</p>
				<div class="mt-8 grid gap-3">
					<button type="button" class="control w-full" data-variant="primary" disabled={!ready || pending} aria-busy={opening === "business-realtor"} onclick={() => choose("business-realtor")}>{opening === "business-realtor" ? "Opening workspace…" : "Impersonate Realtor"}<ArrowRight size={17} aria-hidden="true" /></button>
					<button type="button" class="control w-full" disabled={!ready || pending} aria-busy={opening === "business-assistant"} onclick={() => choose("business-assistant")}>{opening === "business-assistant" ? "Opening workspace…" : "Impersonate Assistant"}<ArrowRight size={17} aria-hidden="true" /></button>
				</div>
				<div class="mt-8"><UserChip accountOnly /></div>
			</section>
		{:else}
			<form method="POST" onsubmit={signIn} aria-labelledby="login-heading">
				<h2 id="login-heading" tabindex="-1" class="font-display text-4xl tracking-tight">Welcome back.</h2>
				<p class="text-muted mt-3 leading-none">Open your shared workspace.</p>
				<div class="mt-8"><label for="email" class="mb-2 block font-medium">Email</label><input id="email" name="email" type="email" autocomplete="username" class="field" required /></div>
				<div class="mt-4"><label for="password" class="mb-2 block font-medium">Password</label><input id="password" name="password" type="password" autocomplete="current-password" class="field" required /></div>
				<button type="submit" class="control mt-5 w-full" data-variant="primary" disabled={!ready || pending} aria-busy={pending}>{pending ? "Signing in…" : "Sign in"}<ArrowRight size={17} aria-hidden="true" /></button>
			</form>
		{/if}
		{#if error}<p role="alert" class="text-urgent mt-4">{error}</p>{/if}
	</div>
</div>

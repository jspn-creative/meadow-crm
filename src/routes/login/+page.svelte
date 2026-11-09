<script lang="ts">
	import { page } from "$app/state";
	import { ArrowRight } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { markLoginEntry, replaceSession } from "#lib/shell/session-navigation.js";
	const supportsCrossDocViewTransition = typeof window !== "undefined" && "CSSViewTransitionRule" in window;
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	let pending = $state(false);
	let exiting = $state(false);
	let error = $state("");
	function destination() {
		const next = page.url.searchParams.get("next");
		if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
		const url = new URL(next, page.url.origin);
		return url.origin === page.url.origin && url.pathname !== "/login" && !url.pathname.startsWith("/api/") ? url.pathname + url.search + url.hash : "/";
	}
	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		pending = true;
		error = "";
		const form = new FormData(event.currentTarget as HTMLFormElement);
		try {
			const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
			if (!response.ok) throw new Error();
			// Mark the entrance for the CSS fallback (unsupported browsers) before navigating. Native cross-document view transitions handle the morph; otherwise the pre-navigation exit motion runs first so the form fades out before replaceSession. The failure path never reaches this, so no wait can hide a failed login.
			markLoginEntry(destination());
			if (!supportsCrossDocViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				exiting = true;
				await new Promise((resolve) => window.setTimeout(resolve, 300));
			}
			replaceSession(destination());
		} catch {
			error = "Unable to sign in. Check your email and password and try again.";
			pending = false;
		}
	}
</script>

<svelte:head><title>Login · Meadow Lane</title></svelte:head>

<div class="flex min-h-[calc(100dvh-6rem)] items-center justify-center px-5 py-12 sm:px-8 lg:min-h-[calc(100dvh-1.5rem)] lg:px-10">
	<form method="POST" class={["w-full max-w-sm", exiting && "login-form-exit"]} onsubmit={signIn}>
		<h2 class="font-display text-4xl tracking-tight">Welcome back.</h2>
		<p class="text-muted mt-3 leading-none">Open your shared workspace.</p>
		<div class="mt-8"><label for="email" class="mb-2 block font-medium">Email</label><input id="email" name="email" type="email" autocomplete="username" class="field" required /></div>
		<div class="mt-4"><label for="password" class="mb-2 block font-medium">Password</label><input id="password" name="password" type="password" autocomplete="current-password" class="field" required /></div>
		<button type="submit" class="control mt-5 w-full" data-variant="primary" disabled={!ready || pending} aria-busy={pending}>{pending ? "Signing in…" : "Sign in"}<ArrowRight size={17} aria-hidden="true" /></button>
		{#if error}<p role="alert" class="text-urgent mt-4">{error}</p>{/if}
	</form>
</div>

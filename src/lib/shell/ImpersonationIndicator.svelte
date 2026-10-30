<script lang="ts">
	import { replaceSession } from "./session-navigation.js";
	import { page } from "$app/state";
	let { role }: { role?: "realtor" | "assistant" } = $props();
	let effectiveRole = $derived(role ?? page.data.support?.effectiveUser);
	let pending = $state(false);
	let message = $state("");
	async function exit() {
		if (pending) return;
		pending = true;
		try {
			const response = await fetch("/api/support/exit", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
			if (!response.ok) throw new Error();
			replaceSession("/support");
		} catch {
			message = "Unable to exit impersonation. Try again.";
			pending = false;
		}
	}
</script>

{#if effectiveRole}
	<aside aria-label="Impersonation" class="surface sticky top-0 z-30 flex flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
		<p class="min-w-0 flex-1 text-sm">Support admin · Impersonating {effectiveRole === "realtor" ? "Realtor" : "Assistant"}</p>
		<button class="control" disabled={pending} onclick={exit}>Switch business user</button>
		<button class="control" disabled={pending} onclick={exit}>Exit impersonation</button>
		{#if message}<p role="alert" class="text-urgent w-full text-sm">{message}</p>{/if}
	</aside>
{/if}

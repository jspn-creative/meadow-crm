<script lang="ts">
	import { exitImpersonation } from "./session-navigation.js";
	let { role }: { role: "realtor" | "assistant" } = $props();
	let pending = $state(false);
	let message = $state("");
	async function exit() {
		if (pending) return;
		pending = true;
		message = "";
		if (!(await exitImpersonation())) {
			message = "Unable to exit. Try again.";
			pending = false;
		}
	}
</script>

<!-- A thin toned edge that is always visible while impersonating; its actions surface on hover or keyboard focus, and the account menu carries them for touch. -->
<aside aria-label="Impersonation" class="impersonation-strip group fixed inset-x-0 top-0 z-40 flex h-(--impersonation-strip) items-center justify-center gap-3 px-4 text-xs font-medium [--action-color:var(--color-white)]">
	<p class="truncate">Impersonating the {role === "realtor" ? "Realtor" : "Assistant"} <span class="opacity-75">· Support admin</span></p>
	{#if message}<p role="alert" class="shrink-0">{message}</p>{/if}
	<div class="flex shrink-0 items-center gap-3 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none pointer-coarse:hidden">
		<button type="button" class="text-action text-xs" disabled={pending} onclick={exit}>Switch user</button>
		<button type="button" class="text-action text-xs" disabled={pending} onclick={exit}>Exit</button>
	</div>
</aside>

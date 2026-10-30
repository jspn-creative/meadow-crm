<script lang="ts">
	import { onDestroy } from "svelte";
	import { Check, CircleAlert, Info, LoaderCircle, X } from "@lucide/svelte";
	type Toast = { id: number; tone: "info" | "loading" | "success" | "error"; title: string; description: string; busy: boolean; action: boolean };
	const id = $props.id();
	let toasts = $state<Toast[]>([]);
	let nextId = 0;
	let loadingId = $state<number | null>(null);
	let failAction = $state(false);
	let announcement = $state("");
	let disposed = false;
	const waits = new Map<ReturnType<typeof setTimeout>, (active: boolean) => void>();
	let loadingExists = $derived(toasts.some((toast) => toast.id === loadingId && toast.tone === "loading"));
	function add(tone: Toast["tone"], title: string, description: string, action = false) {
		const toast = { id: ++nextId, tone, title, description, busy: false, action };
		toasts = [...toasts, toast];
		announcement = `${title}. ${description}`;
		return toast.id;
	}
	function dismiss(toastId: number) {
		toasts = toasts.filter((toast) => toast.id !== toastId);
		if (loadingId === toastId) loadingId = null;
	}
	function updateLoading() {
		const toast = toasts.find((toast) => toast.id === loadingId);
		if (!toast || toast.tone !== "loading") return;
		toast.tone = "success";
		toast.title = "Fixture saved";
		toast.description = "The same loading toast was updated, not replaced.";
		announcement = `${toast.title}. ${toast.description}`;
	}
	async function runAction(toastId: number) {
		const toast = toasts.find((toast) => toast.id === toastId);
		if (!toast || toast.busy) return;
		const shouldFail = failAction;
		toast.busy = true;
		toast.title = "Trying the fixture action…";
		announcement = toast.title;
		const active = await new Promise<boolean>((resolve) => {
			const timer = setTimeout(() => {
				waits.delete(timer);
				resolve(!disposed);
			}, 1000);
			waits.set(timer, resolve);
		});
		if (!active || !toasts.some((item) => item.id === toastId)) return;
		toast.busy = false;
		toast.tone = shouldFail ? "error" : "success";
		toast.title = shouldFail ? "Action failed" : "Action completed";
		toast.description = shouldFail ? "Nothing was dismissed. Turn off simulated failure and retry." : "The asynchronous fixture action succeeded. No CRM record changed.";
		toast.action = shouldFail;
		announcement = `${toast.title}. ${toast.description}`;
	}
	onDestroy(() => {
		disposed = true;
		for (const [timer, resolve] of waits) {
			clearTimeout(timer);
			resolve(false);
		}
		waits.clear();
	});
</script>

<section class="surface grid gap-4 p-5">
	<h3 class="text-lg font-semibold">Toast</h3>
	<p class="text-muted text-sm">An inline toast viewport for comparison, not a workspace notification service. Toasts stay until dismissed; loading stays until you update or dismiss that same instance.</p>
	<div class="flex flex-wrap gap-2">
		<button class="control" type="button" onclick={() => add("info", "A quiet update", "This is a local feedback fixture.")}>Show information</button>
		<button
			class="control"
			type="button"
			disabled={loadingExists}
			onclick={() => {
				loadingId = add("loading", "Saving fixture…", "Waiting for you to update or dismiss this toast.");
			}}>Start loading</button>
		<button class="control" type="button" disabled={!loadingExists} onclick={updateLoading}>Update loading to success</button>
		<button
			class="control"
			type="button"
			disabled={loadingId === null}
			onclick={() => {
				if (loadingId !== null) dismiss(loadingId);
			}}>Dismiss tracked toast</button>
		<button class="control" type="button" onclick={() => add("error", "Fixture needs another try", "Try the asynchronous action. Failures remain visible.", true)}>Show action toast</button>
	</div>
	<label class="flex items-center gap-2 text-sm"><input class="check" type="checkbox" bind:checked={failAction} />Simulate toast action failure</label>
	<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
	<div class="bg-paper grid min-w-0 gap-3 rounded-2xl p-4" role="region" aria-labelledby={`${id}-viewport`}>
		<p id={`${id}-viewport`} class="text-muted text-xs font-semibold">Toast viewport · {toasts.length} visible</p>
		{#if toasts.length === 0}<p class="text-muted py-4 text-center text-sm">Your next feedback specimen appears here.</p>{/if}
		{#each toasts as toast (toast.id)}
			<div class="surface surface-floating flex min-w-0 items-start gap-3 p-4">
				<span class={["mt-0.5 shrink-0", toast.tone === "error" ? "text-urgent" : toast.tone === "success" ? "text-success" : "text-info"]}>
					{#if toast.tone === "loading" || toast.busy}<LoaderCircle class="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />{:else if toast.tone === "success"}<Check size={20} aria-hidden="true" />{:else if toast.tone === "error"}<CircleAlert size={20} aria-hidden="true" />{:else}<Info
							size={20}
							aria-hidden="true" />{/if}
				</span>
				<div class="min-w-0 flex-1">
					<p class="font-semibold">{toast.title}</p>
					<p class="text-muted mt-1 text-sm">{toast.description}</p>
					{#if toast.action}<button class="control mt-3" type="button" disabled={toast.busy} aria-busy={toast.busy} onclick={() => runAction(toast.id)}>{toast.busy ? "Working…" : "Try action"}</button>{/if}
				</div>
				<button class="control shrink-0" data-variant="ghost" data-size="sm" data-icon type="button" aria-label={`Dismiss ${toast.title}`} onclick={() => dismiss(toast.id)}><X size={16} aria-hidden="true" /></button>
			</div>
		{/each}
	</div>
</section>

<script lang="ts">
	import { onDestroy } from "svelte";
	import { Check, CircleAlert, Copy, Info, LoaderCircle } from "@lucide/svelte";
	import FeedbackToasts from "./FeedbackToasts.svelte";

	const id = $props.id();
	let dialog: HTMLDialogElement;
	let cancelButton: HTMLButtonElement;
	let opener: HTMLButtonElement;
	let manualCopy: HTMLInputElement;
	let failConfirmation = $state(false);
	let confirmation = $state<"idle" | "pending" | "error">("idle");
	let confirmationResult = $state("");
	let failButton = $state(false);
	let buttonState = $state<"idle" | "pending" | "success" | "error">("idle");
	let copyState = $state<"idle" | "pending" | "success" | "error">("idle");
	let failCopy = $state(false);
	const copyText = "https://example.com/opportunities/sample";
	let disposed = false;
	const waits = new Map<ReturnType<typeof setTimeout>, (active: boolean) => void>();
	function wait() {
		return new Promise<boolean>((resolve) => {
			const timer = setTimeout(() => {
				waits.delete(timer);
				resolve(!disposed);
			}, 900);
			waits.set(timer, resolve);
		});
	}
	onDestroy(() => {
		disposed = true;
		for (const [timer, resolve] of waits) {
			clearTimeout(timer);
			resolve(false);
		}
		waits.clear();
	});
	function openConfirmation(event: MouseEvent) {
		opener = event.currentTarget as HTMLButtonElement;
		confirmation = "idle";
		dialog.showModal();
		cancelButton.focus();
	}
	async function confirm() {
		if (confirmation === "pending") return;
		const shouldFail = failConfirmation;
		confirmation = "pending";
		if (!(await wait())) return;
		if (shouldFail) {
			confirmation = "error";
			return;
		}
		confirmationResult = "Opportunity archived in this specimen only. No record was changed.";
		confirmation = "idle";
		dialog.close();
	}
	async function runButton() {
		if (buttonState === "pending") return;
		const shouldFail = failButton;
		buttonState = "pending";
		if (await wait()) buttonState = shouldFail ? "error" : "success";
	}
	async function copy() {
		if (copyState === "pending") return;
		copyState = "pending";
		try {
			if (failCopy || !navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
			await navigator.clipboard.writeText(copyText);
			if (!disposed) copyState = "success";
		} catch {
			if (!disposed) copyState = "error";
		}
	}
</script>

<div class="grid min-w-0 gap-8">
	<p class="text-muted text-sm">Interactive feedback recipes · local fixtures only. Nothing here changes CRM records.</p>
	<section class="grid gap-4">
		<h3 class="text-lg font-semibold">Alert</h3>
		<div class="grid gap-3 @min-[42rem]/guide:grid-cols-2">
			<div class="bg-info-soft text-info flex items-start gap-3 rounded-2xl p-4">
				<Info class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
				<div>
					<p class="font-semibold">A little context</p>
					<p class="mt-1 text-sm">These are static examples, not live notifications.</p>
				</div>
			</div>
			<div class="bg-success-soft text-success flex items-start gap-3 rounded-2xl p-4">
				<Check class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
				<div>
					<p class="font-semibold">Changes saved</p>
					<p class="mt-1 text-sm">A calm confirmation that stays in context.</p>
				</div>
			</div>
			<div class="bg-pending-soft text-pending flex items-start gap-3 rounded-2xl p-4">
				<CircleAlert class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
				<div>
					<p class="font-semibold">Check before continuing</p>
					<p class="mt-1 text-sm">Keep important guidance beside the action.</p>
				</div>
			</div>
			<div class="bg-urgent-soft text-urgent flex items-start gap-3 rounded-2xl p-4">
				<CircleAlert class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
				<div>
					<p class="font-semibold">Could not save</p>
					<p class="mt-1 text-sm">Explain what happened and offer a way to retry.</p>
				</div>
			</div>
		</div>
	</section>
	<section class="surface grid gap-4 p-5">
		<h3 class="text-lg font-semibold">Alert dialog</h3>
		<p class="text-muted text-sm">A native modal with a simulated confirmation. Failure stays open; success closes it.</p>
		<div><button class="control" type="button" onclick={openConfirmation}>Try archive confirmation</button></div>
		<p role="status" class="text-success text-sm">{confirmationResult}</p>
	</section>
	<dialog
		bind:this={dialog}
		class="dialog p-6"
		data-size="sm"
		aria-labelledby={`${id}-dialog-title`}
		aria-describedby={`${id}-dialog-description`}
		oncancel={(event) => {
			if (confirmation === "pending") event.preventDefault();
		}}
		onclose={() => opener?.focus()}>
		<h3 id={`${id}-dialog-title`} class="text-xl font-semibold">Archive this opportunity?</h3>
		<p id={`${id}-dialog-description`} class="text-muted mt-3 text-sm">In the app, archiving hides an opportunity from default views and allows it to be restored. This specimen changes nothing.</p>
		<label class="mt-5 flex items-center gap-2 text-sm"><input class="check" type="checkbox" bind:checked={failConfirmation} disabled={confirmation === "pending"} />Simulate a failed confirmation</label>
		<p class="text-urgent mt-3 min-h-6 text-sm" role="status">{confirmation === "error" ? "Archive failed. Uncheck the failure option and retry, or cancel." : confirmation === "pending" ? "Archiving the fixture…" : ""}</p>
		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<button bind:this={cancelButton} class="control" type="button" disabled={confirmation === "pending"} onclick={() => dialog.close()}>Cancel</button>
			<button class="control" data-variant="primary" type="button" disabled={confirmation === "pending"} aria-busy={confirmation === "pending"} onclick={confirm}>{confirmation === "pending" ? "Archiving…" : confirmation === "error" ? "Retry archive" : "Archive opportunity"}</button>
		</div>
	</dialog>
	<div class="grid min-w-0 gap-6 @min-[42rem]/guide:grid-cols-2">
		<section class="surface grid content-start gap-4 p-5">
			<h3 class="text-lg font-semibold">Loading button</h3>
			<label class="flex items-center gap-2 text-sm"><input class="check" type="checkbox" bind:checked={failButton} disabled={buttonState === "pending"} />Simulate failure</label>
			<div>
				<button class="control min-w-40 motion-reduce:transition-none" data-variant="primary" type="button" disabled={buttonState === "pending"} aria-busy={buttonState === "pending"} onclick={runButton}>
					{#if buttonState === "pending"}<LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{:else if buttonState === "success"}<Check size={16} aria-hidden="true" />{:else if buttonState === "error"}<CircleAlert size={16} aria-hidden="true" />{/if}
					{buttonState === "pending" ? "Saving…" : buttonState === "success" ? "Saved · try again" : buttonState === "error" ? "Retry save" : "Save fixture"}
				</button>
			</div>
			<p role="status" class="text-muted min-h-6 text-sm">{buttonState === "success" ? "Simulated save succeeded." : buttonState === "error" ? "Simulated save failed. Your fixture is still here." : buttonState === "pending" ? "Simulating a save…" : "No network request is made."}</p>
		</section>
		<section class="surface grid min-w-0 content-start gap-4 p-5">
			<h3 class="text-lg font-semibold">Copy button</h3>
			<label class="grid gap-2 text-sm" for={`${id}-copy`}>Sample reference<input bind:this={manualCopy} id={`${id}-copy`} class="field min-w-0" readonly value={copyText} /></label>
			<label class="flex items-center gap-2 text-sm"><input class="check" type="checkbox" bind:checked={failCopy} disabled={copyState === "pending"} />Simulate clipboard failure</label>
			<div class="flex flex-wrap gap-2">
				<button class="control" type="button" disabled={copyState === "pending"} aria-busy={copyState === "pending"} onclick={copy}
					>{#if copyState === "success"}<Check size={16} aria-hidden="true" />{:else}<Copy size={16} aria-hidden="true" />{/if}{copyState === "pending" ? "Copying…" : copyState === "success" ? "Copied · copy again" : "Copy reference"}</button
				>{#if copyState === "error"}<button
						class="control"
						type="button"
						onclick={() => {
							manualCopy.focus();
							manualCopy.select();
						}}>Select for manual copy</button
					>{/if}
			</div>
			<p role="status" class="text-muted min-h-6 text-sm">{copyState === "error" ? "Clipboard unavailable. Select the reference and use your device’s Copy command." : copyState === "success" ? "Reference copied to your clipboard." : "Uses your actual clipboard; the reference is a fixture."}</p>
		</section>
	</div>
	<FeedbackToasts />
</div>

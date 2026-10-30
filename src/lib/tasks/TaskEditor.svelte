<script lang="ts">
	import { untrack } from "svelte";
	import { X } from "@lucide/svelte";
	import { createTask, saveTask, completeTask, deleteTask, getWorkspace } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import Select from "#lib/ui/Select.svelte";
	import ImpersonationIndicator from "#lib/shell/ImpersonationIndicator.svelte";
	type Task = Workspace["tasks"][number];
	let { task, workspace, remote, close }: { task?: Task; workspace: Workspace; remote: ReturnType<typeof getWorkspace>; close: () => void } = $props();
	const heading = $props.id();
	const taskId = untrack(() => task?.id) ?? crypto.randomUUID();
	let title = $state(untrack(() => task?.title ?? ""));
	let date = $state(untrack(() => task?.date ?? workspace.businessToday));
	let dueDate = $state(untrack(() => task?.dueDate ?? ""));
	let link = $state(untrack(() => (task?.clientId ? `client:${task.clientId}` : task?.opportunityId ? `opportunity:${task.opportunityId}` : "")));
	let revision = $state(untrack(() => task?.revision));
	let pending = $state(false);
	let failure = $state("");
	let confirmingDelete = $state(false);
	let previousPayload = "";
	let requestId = "";
	let changes = $derived(workspace.history.filter((change) => change.recordKind === "task" && change.recordId === taskId));
	let stale = $derived(task && revision !== task.revision);
	let options = $derived([
		{ value: "", label: "No linked record" },
		...workspace.referenceClients.filter((row) => !row.archivedAt || row.id === task?.clientId).map((row) => ({ value: `client:${row.id}`, label: `Client · ${row.name}${row.archivedAt ? " (archived)" : ""}` })),
		...workspace.referenceOpportunities.filter((row) => !row.archivedAt || row.id === task?.opportunityId).map((row) => ({ value: `opportunity:${row.id}`, label: `Opportunity · ${row.title}${row.archivedAt ? " (archived)" : ""}` })),
	]);
	let format = $derived(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: workspace.settings?.timezone ?? "America/New_York" }));
	const person = (id: string) => ({ "business-realtor": "Realtor", "business-assistant": "Assistant", "support-admin": "Support admin" })[id] ?? id;

	function loadCurrent() {
		if (!task) return;
		title = task.title;
		date = task.date;
		dueDate = task.dueDate ?? "";
		link = task.clientId ? `client:${task.clientId}` : task.opportunityId ? `opportunity:${task.opportunityId}` : "";
		revision = task.revision;
		failure = "";
	}
	async function mutate(action: "save" | "complete" | "delete") {
		if (pending) return;
		const details = { id: taskId, title: title.trim(), date, dueDate: dueDate || null, clientId: link.startsWith("client:") ? link.slice(7) : null, opportunityId: link.startsWith("opportunity:") ? link.slice(12) : null };
		const payload = JSON.stringify({ action, ...details, revision, completed: !task?.completedAt });
		if (payload !== previousPayload) {
			previousPayload = payload;
			requestId = crypto.randomUUID();
		}
		pending = true;
		failure = "";
		try {
			if (action === "delete" && revision) await deleteTask({ id: taskId, revision, requestId }).updates(remote);
			else if (action === "complete" && revision) await completeTask({ id: taskId, revision, requestId, completed: !task?.completedAt }).updates(remote);
			else if (revision) await saveTask({ ...details, revision, requestId }).updates(remote);
			else await createTask({ ...details, requestId }).updates(remote);
			close();
		} catch {
			failure = "Task could not be saved. Your draft is retained; check the fields and retry.";
			try {
				await remote.refresh();
			} catch {
				/* Keep the draft available when the network is unavailable. */
			}
		} finally {
			pending = false;
		}
	}
</script>

<dialog
	class="dialog"
	data-size="md"
	aria-labelledby={heading}
	{@attach (element) => {
		const opener = document.activeElement;
		element.showModal();
		return () => {
			if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
		};
	}}
	oncancel={(event) => {
		if (pending) event.preventDefault();
		else close();
	}}
	onclose={close}>
	<ImpersonationIndicator />
	<header class="bg-canvas/95 border-hairline sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2.5 sm:px-6">
		<span class="text-muted text-sm">{task ? "Task" : "New task"}</span>
		<button type="button" class="control ml-auto" data-variant="ghost" data-size="sm" data-icon aria-label="Close task" disabled={pending} onclick={close}><X size={17} aria-hidden="true" /></button>
	</header>
	<div class="@container/task min-w-0 space-y-6 px-4 py-5 sm:px-8 sm:py-7">
		<h2 id={heading} class="font-display text-3xl tracking-tight">{task ? task.title : "New task"}</h2>
		{#if task}<p class="text-muted text-sm">{task.completedAt ? "Completed" : "Assigned to the realtor"}</p>{/if}
		{#if stale}<div class="bg-pending-soft space-y-2 rounded-xl p-3" role="alert">
				<p>This task changed. Current saved title: {task?.title}. Load the current task before saving again.</p>
				<button type="button" class="control" disabled={pending} onclick={loadCurrent}>Load current task</button>
			</div>{/if}
		<form
			class="space-y-6"
			aria-label="Task editor"
			aria-busy={pending}
			onsubmit={(event) => {
				event.preventDefault();
				void mutate("save");
			}}>
			<fieldset disabled={pending || !!stale} class="min-w-0 space-y-5">
				<label for={`${heading}-title`} class="block space-y-1.5"><span class="text-muted text-xs font-medium">Title</span><input id={`${heading}-title`} class="field" bind:value={title} required maxlength="200" /></label>
				<div class="grid min-w-0 gap-4 @min-[24rem]/task:grid-cols-2">
					<label for={`${heading}-date`} class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium">Date</span><input id={`${heading}-date`} class="field" type="date" bind:value={date} required /></label>
					<label for={`${heading}-due`} class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium">Due date (optional)</span><input id={`${heading}-due`} class="field" type="date" bind:value={dueDate} /></label>
				</div>
				<section class="space-y-2" aria-label="References">
					<h3 class="text-muted text-xs font-medium">References</h3>
					<Select label="Client or opportunity (optional)" bind:value={link} {options} />
					{#if task?.clientId}<a class="text-action" href={`/registry?client=${encodeURIComponent(task.clientId)}`}>Open {workspace.referenceClients.find((row) => row.id === task?.clientId)?.name ?? "client"}</a>{:else if task?.opportunityId}<a
							class="text-action"
							href={`/pipeline?opportunity=${encodeURIComponent(task.opportunityId)}`}>Open {workspace.referenceOpportunities.find((row) => row.id === task?.opportunityId)?.title ?? "opportunity"}</a
						>{/if}
				</section>
			</fieldset>
			{#if failure}<p class="text-urgent bg-urgent-soft rounded-xl px-3 py-2" role="alert">{failure}</p>{/if}
			<div class="border-hairline flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" class="control" disabled={pending} onclick={close}>Cancel</button><button class="control" data-variant="primary" disabled={pending || !!stale}>{pending ? "Saving…" : "Save task"}</button></div>
		</form>
		{#if task}
			<div class="flex flex-wrap items-center gap-3">
				<button type="button" class="control" disabled={pending || !!stale} onclick={() => mutate("complete")}>{task.completedAt ? "Reopen task" : "Complete task"}</button><button type="button" class="control" data-variant="ghost" disabled={pending || !!stale} onclick={() => (confirmingDelete = !confirmingDelete)}
					>Delete task</button>
			</div>
			{#if confirmingDelete}<div class="bg-urgent-soft space-y-3 rounded-xl p-3">
					<p>Delete this task permanently?</p>
					<button type="button" class="control" disabled={pending || !!stale} onclick={() => mutate("delete")}>Confirm delete</button>
				</div>{/if}
			<section class="border-hairline space-y-3 border-t pt-4" aria-label="History">
				<h3 class="font-display text-xl">History</h3>
				<ol class="space-y-3">
					{#each changes as change (change.id)}<li class="text-sm">
							<p>
								{person(change.effectiveUserId)} · {change.action}{#if change.actorUserId !== change.effectiveUserId}
									(acting user: {person(change.actorUserId)}){/if}
							</p>
							<time class="text-muted text-xs" datetime={change.createdAt}>{format.format(new Date(change.createdAt))}</time>
							<details>
								<summary class="text-muted cursor-pointer text-xs">Changed data</summary>
								<pre class="bg-paper/50 mt-2 max-h-48 overflow-auto rounded-lg p-3 text-xs wrap-anywhere whitespace-pre-wrap">{JSON.stringify(change.data, null, 2)}</pre>
							</details>
						</li>{:else}<li class="text-muted text-sm">No changes recorded.</li>{/each}
				</ol>
			</section>
		{/if}
	</div>
</dialog>

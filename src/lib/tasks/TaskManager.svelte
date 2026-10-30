<script lang="ts">
	import { getWorkspace, completeTask } from "#lib/crm.remote.js";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { dueLabel, dueState } from "#lib/pipeline/due.js";
	import TaskList from "./TaskList.svelte";
	import TaskEditor from "./TaskEditor.svelte";
	import type { TaskListItem } from "./types.js";
	import Select from "#lib/ui/Select.svelte";
	let { upcoming = false }: { upcoming?: boolean } = $props();
	const remote = getWorkspace({ archived: false });
	let workspace = $derived(await remote);
	let filter = $state("today");
	let selectedId = $state<string | null>(null);
	let creating = $state(false);
	let busy = $state(false);
	let failure = $state("");
	let retry: (() => Promise<void>) | undefined = $state();
	let end = $derived(new Date(Date.parse(`${workspace.businessToday}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10));
	let linkedId = $derived(!upcoming ? page.url.searchParams.get("task") : null);
	let selected = $derived(workspace.tasks.find((task) => task.id === (selectedId ?? linkedId)));
	function closeTask() {
		selectedId = null;
		if (linkedId) {
			const url = new URL(page.url.href);
			url.searchParams.delete("task");
			void goto(url, { replace: true, reset: false });
		}
	}
	let items = $derived(
		workspace.tasks
			.filter((task) => {
				if (upcoming) return !task.completedAt && ((task.date > workspace.businessToday && task.date <= end) || (task.dueDate && task.dueDate > workspace.businessToday && task.dueDate <= end));
				if (filter === "completed") return !!task.completedAt;
				return filter === "all" || (!task.completedAt && task.date <= workspace.businessToday);
			})
			.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
			.map((task): TaskListItem => ({
				id: task.id,
				title: task.title,
				completed: !!task.completedAt,
				context: task.clientId ? workspace.referenceClients.find((row) => row.id === task.clientId)?.name : task.opportunityId ? workspace.referenceOpportunities.find((row) => row.id === task.opportunityId)?.title : undefined,
				due: task.dueDate ? `Due ${dueLabel(task.dueDate, workspace.businessToday)}` : "",
				dueState: task.completedAt ? "undated" : dueState(task.dueDate ?? "", workspace.businessToday),
				note: `Date: ${dueLabel(task.date, workspace.businessToday)}`,
			})),
	);
	async function toggle(id: string) {
		const task = workspace.tasks.find((row) => row.id === id);
		if (!task || busy) return;
		const input = { id, revision: task.revision, completed: !task.completedAt, requestId: crypto.randomUUID() };
		async function send() {
			busy = true;
			failure = "";
			try {
				await completeTask(input).updates(remote.withOverride((snapshot) => ({ ...snapshot, tasks: snapshot.tasks.map((row) => (row.id === id ? { ...row, completedAt: input.completed ? new Date().toISOString() : null } : row)) })));
				retry = undefined;
			} catch {
				failure = "Task could not be saved. Retry, or open the task to review its current version.";
				retry = send;
				try {
					await remote.refresh();
				} catch {
					/* A failed connection must not hide the retry action. */
				}
			} finally {
				busy = false;
			}
		}
		await send();
	}
</script>

<div class="space-y-(--card-gap)">
	{#if !upcoming}<div class="flex flex-wrap items-center justify-between gap-3">
			<Select
				class="min-w-0"
				label="Show tasks"
				bind:value={filter}
				options={[
					{ value: "today", label: "Today's Tasks" },
					{ value: "all", label: "All tasks" },
					{ value: "completed", label: "Completed tasks" },
				]} /><button type="button" class="control" onclick={() => (creating = true)}>New task</button>
		</div>{/if}
	{#if failure}<p class="text-urgent text-sm" role="alert">
			{failure}
			{#if retry}<button type="button" class="text-action" disabled={busy} onclick={() => retry?.()}>Retry</button>{/if}
		</p>{/if}
	<TaskList {items} open={(id) => (selectedId = id)} {toggle} {busy} />
	{#if !items.length}<p class="text-muted text-sm">{upcoming ? "No tasks coming up in the next 14 days. Create a task with a future date in Today's Tasks." : filter === "completed" ? "No completed tasks yet." : "No tasks here. Create a task to add work to the realtor's list."}</p>{/if}
</div>
{#if creating}<TaskEditor {workspace} {remote} close={() => (creating = false)} />{:else if selected}<TaskEditor task={selected} {workspace} {remote} close={closeTask} />{/if}

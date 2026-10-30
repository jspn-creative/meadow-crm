<script lang="ts">
	import { Sparkles, Orbit, Sprout, Coffee, History } from "@lucide/svelte";
	import { getRecentActivity } from "#lib/crm.remote.js";
	import { stageLabels } from "#lib/pipeline/labels.js";
	const remote = getRecentActivity();
	let activity = $derived(await remote);
	let format = $derived(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: activity.timezone }));
	const person = (id: string) => ({ "business-realtor": "Realtor", "business-assistant": "Assistant", "support-admin": "Support admin" })[id] ?? id;
	const illustration = [
		{ id: "universe", title: "The universe opens for business.", detail: "Big expansion. No paperwork.", date: "13.8 billion years ago", icon: Sparkles, color: "tour" },
		{ id: "earth", title: "Earth finds its forever home.", detail: "Great light. Excellent orbital location.", date: "4.5 billion years ago", icon: Orbit, color: "info" },
		{ id: "life", title: "Life moves in.", detail: "Starts small. Really makes the place its own.", date: "About 3.7 billion years ago", icon: Sprout, color: "success" },
		{ id: "today", title: "You arrive. Coffee recommended.", detail: "Your workspace history starts here.", date: "Today", icon: Coffee, color: "pending" },
	] as const;
	function describe(change: (typeof activity.changes)[number]) {
		const kind = change.recordKind;
		switch (change.action) {
			case "create":
				return `created this ${kind}`;
			case "edit":
				return `edited this ${kind}`;
			case "complete":
				return "completed this task";
			case "reopen":
				return "reopened this task";
			case "archive":
				return `archived this ${kind}`;
			case "restore":
				return `restored this ${kind}`;
			case "pin":
				return "pinned this opportunity";
			case "unpin":
				return "unpinned this opportunity";
			case "move-stage":
				return `moved this opportunity to ${stageLabels[change.data.stage as keyof typeof stageLabels] ?? "another stage"}`;
			case "save-checklist-step":
				return change.data.completed ? "checked off a checklist item" : "updated a checklist item";
			case "add-checklist-item":
				return "added a checklist item";
			default:
				return `updated this ${kind}`;
		}
	}
	function recordLink(change: (typeof activity.changes)[number]) {
		const id = encodeURIComponent(change.recordId);
		if (change.recordKind === "task") return `/?task=${id}`;
		if (change.recordKind === "client") return `/registry?client=${id}${change.archivedAt ? "&archived=true" : ""}`;
		return change.archivedAt ? `/pipeline/archived#opportunity-${id}` : `/pipeline?opportunity=${id}`;
	}
</script>

{#if activity.changes.length}
	<ol class="divide-hairline divide-y">
		{#each activity.changes as change (change.id)}
			<li class="flex min-w-0 gap-(--row-pad) px-(--row-pad) py-3 first:pt-0 last:pb-0">
				<span class="bg-info-soft text-info flex size-8 shrink-0 items-center justify-center rounded-full"><History size={15} aria-hidden="true" /></span>
				<div class="min-w-0 flex-1">
					<a class="item-title text-action wrap-anywhere" href={recordLink(change)}>{change.title}</a>
					<p class="text-muted mt-1 text-xs leading-5 wrap-anywhere">
						{person(change.effectiveUserId)}
						{describe(change)}{#if change.actorUserId !== change.effectiveUserId}{" "}(acting user: {person(change.actorUserId)}){/if}.
					</p>
					<time class="text-muted mt-1 block text-xs" datetime={change.createdAt}>{format.format(new Date(change.createdAt))}</time>
				</div>
			</li>
		{/each}
	</ol>
{:else}
	<p class="text-muted mb-5 text-sm">No workspace activity yet. Create a task, client, or opportunity to start your history.</p>
	<ol aria-label="Illustration only: a playful history of the universe, not business history." class="px-(--row-pad)">
		{#each illustration as item (item.id)}
			<li class="before:bg-hairline relative flex gap-(--row-pad) pb-(--card-pad) before:absolute before:top-9 before:bottom-1 before:left-[15px] before:w-px last:pb-0 last:before:hidden" style:--item-hue={`var(--color-${item.color}-soft)`} style:--item-ink={`var(--color-${item.color})`}>
				<span class="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-(--item-hue) text-(--item-ink)"><item.icon size={15} strokeWidth={1.7} aria-hidden="true" /></span>
				<div class="min-w-0 pt-0.5">
					<p class="item-title">{item.title}</p>
					<p class="text-muted mt-1 text-xs leading-5">{item.detail}</p>
					<p class="text-muted mt-1 text-xs">{item.date}</p>
				</div>
			</li>
		{/each}
	</ol>
{/if}

<script lang="ts">
	import type { Component } from "svelte";
	import { Sparkles, Orbit, Sprout, Coffee, History, House, Mail, Megaphone, MessageSquare, Phone, StickyNote, UserPlus, Users } from "@lucide/svelte";
	import { getRecentActivity, getWorkspace } from "#lib/crm.remote.js";
	import { calledName } from "#lib/activity/client-facts.js";
	import { describeContact, describeEvent, describeHistory, describeNote, emphasize, joinsEdit, type ActivityLookup, type Line } from "#lib/activity/describe.js";
	import { activityEntries } from "#lib/activity/entries.js";
	import { activityDates } from "#lib/activity/feed.js";
	import type { ActivityEntry, Channel, Detail, HistoryEntry } from "#lib/activity/types.js";
	// Both load at once; the workspace names the records and clients the describer needs.
	const remote = getRecentActivity();
	const workspaceQuery = getWorkspace({ archived: false });
	let [activity, workspace] = $derived(await Promise.all([remote, workspaceQuery]));
	let format = $derived(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: activity.timezone }));
	let dates = $derived(activityDates(activity.timezone));
	const illustration = [
		{ id: "universe", title: "The universe opens for business.", detail: "Big expansion. No paperwork.", date: "13.8 billion years ago", icon: Sparkles, color: "tour" },
		{ id: "earth", title: "Earth finds its forever home.", detail: "Great light. Excellent orbital location.", date: "4.5 billion years ago", icon: Orbit, color: "info" },
		{ id: "life", title: "Life moves in.", detail: "Starts small. Really makes the place its own.", date: "About 3.7 billion years ago", icon: Sprout, color: "success" },
		{ id: "today", title: "You arrive. Coffee recommended.", detail: "Your workspace history starts here.", date: "Today", icon: Coffee, color: "pending" },
	] as const;
	const channelIcons: Record<Channel, Component> = { call: Phone, text: MessageSquare, email: Mail, meeting: Users, other: Megaphone, zillow: House };
	const shown = 20;

	type RecordRef = (typeof activity.rows)[number]["record"];
	type Row = { id: string; at: string; recordedAt: string; record: RecordRef; icon: Component; line: Line; quote?: string; detail?: Detail[] };

	let lookup: ActivityLookup = $derived({
		client: (id) => workspace.referenceClients.find((client) => client.id === id)?.name ?? "a removed client",
		tag: (id) => workspace.tags.find((tag) => tag.id === id)?.name ?? "a removed",
		item: (id) => workspace.checklists.flatMap((list) => list.items).find((item) => item.id === id)?.title,
	});
	/** The name sentences use for the record's client, as its own Activity does. */
	function called(record: RecordRef) {
		if (record.kind === "client") {
			const client = workspace.clients.find((row) => row.id === record.id);
			return client ? calledName(client) : record.title;
		}
		const clients = workspace.links.filter((link) => link.opportunityId === record.id).flatMap((link) => workspace.clients.filter((client) => client.id === link.clientId));
		return clients.length === 1 ? calledName(clients[0]!) : clients.map((client) => client.name).join(" and ") || "the client";
	}

	// Each entry reads as it does in its record's Activity, worded by the same describer, with consecutive saves to one record grouped the same way.
	let rows = $derived.by(() => {
		const source = new Map(activity.rows.map((row) => [row.id, row]));
		const entries = activityEntries(activity.rows, lookup).toReversed();
		const items: { record: RecordRef; recordedAt: string; entries: ActivityEntry[] }[] = [];
		const open = new Map<string, (typeof items)[number]>();
		for (const entry of entries) {
			const row = source.get(entry.id);
			if (!row) continue;
			const key = `${row.record.kind}:${row.record.id}`;
			const previous = open.get(key);
			const last = previous?.entries.at(-1);
			if (entry.kind === "history" && entry.changes && last?.kind === "history" && last.changes && joinsEdit(last, entry)) {
				previous!.entries.push(entry);
				previous!.recordedAt = row.recordedAt;
				continue;
			}
			const item = { record: row.record, recordedAt: row.recordedAt, entries: [entry] };
			items.push(item);
			open.set(key, item);
		}
		return items
			.flatMap((item): Row[] => {
				const client = called(item.record);
				const entry = item.entries[0]!;
				const base = { id: entry.id, at: entry.at, recordedAt: item.recordedAt, record: item.record };
				if (entry.kind === "history") {
					const described = describeHistory(item.entries as HistoryEntry[], client, dates);
					return described ? [{ ...base, at: described.at, icon: History, line: described.line, detail: described.detail }] : [];
				}
				if (entry.kind === "note") return [{ ...base, icon: StickyNote, line: describeNote(entry, client), quote: entry.body }];
				if (entry.kind === "contact") return [{ ...base, icon: channelIcons[entry.channel], line: describeContact(entry, client), quote: entry.note, detail: entry.detail }];
				return [{ ...base, icon: UserPlus, line: describeEvent(entry, client), detail: entry.detail }];
			})
			.toSorted((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id))
			.slice(0, shown);
	});

	function recordLink(record: RecordRef) {
		const id = encodeURIComponent(record.id);
		if (record.kind === "task") return `/?task=${id}`;
		if (record.kind === "client") return `/registry?client=${id}${record.archivedAt ? "&archived=true" : ""}`;
		return record.archivedAt ? `/pipeline/archived#opportunity-${id}` : `/pipeline?opportunity=${id}`;
	}
</script>

{#snippet sentence(line: Line)}
	{#if line.who}<span class="font-medium">{line.who}</span>{" "}{/if}{#each emphasize(line) as part}{#if part.em}<span class="font-medium">{part.text}</span>{:else}{part.text}{/if}{/each}{#if line.tail}<span class="text-muted">{" · "}{line.tail}</span>{/if}
{/snippet}

{#if rows.length}
	<ol class="divide-hairline divide-y">
		{#each rows as row (row.id)}
			<li class="flex min-w-0 gap-(--row-pad) px-(--row-pad) py-3 first:pt-0 last:pb-0">
				<span class="bg-info-soft text-info flex size-8 shrink-0 items-center justify-center rounded-full"><row.icon size={15} aria-hidden="true" /></span>
				<div class="min-w-0 flex-1">
					{#if row.detail}
						<details>
							<summary class="item-title cursor-pointer wrap-anywhere">{@render sentence(row.line)}</summary>
							<dl class="border-hairline mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 border-l pl-3 text-xs">
								{#each row.detail as item (item.label)}
									<dt class="text-muted">{item.label}</dt>
									<dd class="min-w-0 wrap-anywhere">{item.value}</dd>
								{/each}
							</dl>
						</details>
					{:else}
						<p class="item-title wrap-anywhere">{@render sentence(row.line)}</p>
					{/if}
					{#if row.quote}<p class="text-muted mt-1 line-clamp-2 text-xs leading-5 wrap-anywhere whitespace-pre-line">{row.quote}</p>{/if}
					<p class="text-muted mt-1 flex min-w-0 flex-wrap gap-x-1.5 text-xs leading-5">
						<a class="text-action min-w-0 truncate" href={recordLink(row.record)}>{row.record.title}</a>
						<span aria-hidden="true">·</span>
						<time datetime={row.at}>{format.format(new Date(row.at))}</time>
					</p>
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
					<p class="text-muted mt-1 text-xs leading-none">{item.date}</p>
				</div>
			</li>
		{/each}
	</ol>
{/if}

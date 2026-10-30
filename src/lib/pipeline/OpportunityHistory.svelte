<script lang="ts">
	import { Archive, ArchiveRestore, ArrowRightLeft, CircleCheck, ListChecks, PencilLine, Pin, PinOff, Sparkles } from "@lucide/svelte";
	import type { Workspace } from "#lib/data/workspace.js";
	import { stageLabels } from "./labels.js";
	type Change = Workspace["history"][number];
	let { workspace, changes }: { workspace: Workspace; changes: Change[] } = $props();

	const fieldNames: Record<string, string> = { title: "title", timeline: "timeline", address: "property address", budgetCents: "budget", notes: "notes", clientIds: "clients", references: "references" };
	const person = (id: string) => ({ "business-realtor": "Realtor", "business-assistant": "Assistant", "support-admin": "Support admin" })[id] ?? id;
	const list = (words: string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`);
	const comparable = (key: string, value: unknown) => (key === "references" && Array.isArray(value) ? value.map((reference) => reference?.label).join("|") : key === "clientIds" && Array.isArray(value) ? [...value].sort().join("|") : JSON.stringify(value ?? null));
	let itemTitles = $derived(new Map(workspace.checklists.flatMap((checklist) => checklist.items.map((item) => [item.id, item.title]))));

	function describe(change: Change): { icon: typeof Sparkles; text: string } {
		const data = (change.data ?? {}) as Record<string, any>;
		switch (change.action) {
			case "create":
				return { icon: Sparkles, text: "created this opportunity" };
			case "move-stage":
				return { icon: ArrowRightLeft, text: `moved it to ${stageLabels[data.stage as keyof typeof stageLabels] ?? data.stage}` };
			case "archive":
				return { icon: Archive, text: "archived it" };
			case "restore":
				return { icon: ArchiveRestore, text: "restored it" };
			case "pin":
				return { icon: Pin, text: "pinned it" };
			case "unpin":
				return { icon: PinOff, text: "unpinned it" };
			case "save-checklist-step": {
				const title = itemTitles.get(data.itemId);
				const subject = title ? `“${title}”` : "a checklist item";
				return { icon: data.completed ? CircleCheck : ListChecks, text: data.completed ? `checked off ${subject}` : `updated ${subject}` };
			}
			case "edit": {
				const changed = Object.keys(fieldNames).filter((key) => data.before && data.after && comparable(key, data.before[key]) !== comparable(key, data.after[key]));
				return { icon: PencilLine, text: changed.length ? `changed the ${list(changed.map((key) => fieldNames[key]))}` : "saved the details" };
			}
			default:
				return { icon: PencilLine, text: change.action.replaceAll("-", " ") };
		}
	}
	let format = $derived(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: workspace.settings?.timezone ?? "America/Los_Angeles" }));
</script>

{#if changes.length}
	<ol class="before:bg-hairline relative space-y-1 before:absolute before:top-4 before:bottom-4 before:left-[1.375rem] before:w-px">
		{#each changes as change (change.id)}
			{@const { icon: Icon, text } = describe(change)}
			<li class="relative flex gap-3 px-2.5 py-2">
				<span class="border-hairline text-muted relative flex size-6 shrink-0 items-center justify-center rounded-full border bg-white"><Icon size={13} aria-hidden="true" /></span>
				<div class="min-w-0 flex-1 text-sm/6">
					<p class="wrap-anywhere">
						<span class="font-medium">{person(change.effectiveUserId)}</span>{#if change.actorUserId !== change.effectiveUserId}<span class="text-muted"> (acting user: {person(change.actorUserId)})</span>{/if}
						{text}
					</p>
					<div class="text-muted flex flex-wrap items-center gap-x-3 text-xs leading-5">
						<time datetime={change.createdAt}>{format.format(new Date(change.createdAt))}</time>
						<details class="open:basis-full">
							<summary class="hover:text-ink cursor-pointer list-none underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">Changed data</summary>
							<pre class="bg-paper/50 text-muted mt-2 max-h-56 overflow-auto rounded-lg p-3 text-[0.6875rem]/4 wrap-anywhere whitespace-pre-wrap">{JSON.stringify(change.data, null, 2)}</pre>
						</details>
					</div>
				</div>
			</li>
		{/each}
	</ol>
{:else}
	<p class="text-muted px-3 py-2">No changes recorded.</p>
{/if}

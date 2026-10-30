<script lang="ts">
	import { ArrowUpRight, Globe, Link2Off, UserRound, X } from "@lucide/svelte";
	import type { Workspace } from "#lib/data/workspace.js";
	import { safeReferenceUrl } from "./opportunity-draft.js";
	import { typeStyles } from "./labels.js";
	type Reference = Workspace["references"][number];
	let { workspace, references, openOpportunity, remove = null }: { workspace: Workspace; references: Reference[]; openOpportunity: (id: string) => boolean; remove: ((reference: Reference) => void) | null } = $props();
	const host = (href: string) => new URL(href).hostname.replace(/^www\./, "");
	const tile = "surface flex min-w-0 items-center gap-2.5 py-2 pr-2.5 pl-2";
</script>

<ul class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13.5rem),1fr))] gap-2">
	{#each references as reference (reference.id)}
		<li class="group/ref relative min-w-0">
			{#if reference.kind === "url"}
				{@const href = safeReferenceUrl(reference.url)}
				{#if href}
					<a class={[tile, "hover:bg-highlight"]} {href} target="_blank" rel="noopener noreferrer" aria-label={`${reference.label} (opens a new tab)`}>
						<span class="bg-info-soft text-info flex size-9 shrink-0 items-center justify-center rounded-lg"><Globe size={16} aria-hidden="true" /></span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm/5 font-medium">{reference.label}</span>
							<span class="text-muted block truncate text-xs leading-4">{host(href)}</span>
						</span>
						<ArrowUpRight size={14} class="text-muted group-hover/ref:text-ink shrink-0 transition-colors" aria-hidden="true" />
					</a>
				{:else}
					<div class={tile}>
						<span class="bg-paper text-muted flex size-9 shrink-0 items-center justify-center rounded-lg"><Link2Off size={16} aria-hidden="true" /></span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm/5 font-medium">{reference.label}</span>
							<span class="text-muted block text-xs leading-4">Unsafe link unavailable</span>
						</span>
					</div>
				{/if}
			{:else if reference.kind === "client"}
				{@const client = workspace.referenceClients.find((row) => row.id === reference.targetClientId)}
				<a class={[tile, "hover:bg-highlight"]} href={`/registry?client=${encodeURIComponent(reference.targetClientId ?? "")}`} aria-label={reference.label}>
					<span class="bg-success-soft text-success flex size-9 shrink-0 items-center justify-center rounded-lg"><UserRound size={16} aria-hidden="true" /></span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm/5 font-medium">{reference.label}</span>
						<span class="text-muted block truncate text-xs leading-4">Client{client && client.name !== reference.label ? ` · ${client.name}` : ""}</span>
					</span>
				</a>
			{:else}
				{@const target = workspace.opportunities.find((row) => row.id === reference.targetOpportunityId)}
				{@const name = workspace.referenceOpportunities.find((row) => row.id === reference.targetOpportunityId)?.title}
				{@const style = target ? typeStyles[target.type] : null}
				{@const Icon = style?.icon}
				<a
					class={[tile, "hover:bg-highlight"]}
					href={`/pipeline?opportunity=${encodeURIComponent(reference.targetOpportunityId ?? "")}`}
					aria-label={reference.label}
					onclick={(event) => {
						if (reference.targetOpportunityId && openOpportunity(reference.targetOpportunityId)) event.preventDefault();
					}}>
					<span class="flex size-9 shrink-0 items-center justify-center rounded-lg" style:background={style ? `var(--color-category-${style.tone})` : "var(--color-paper)"} style:color={style ? `var(--color-category-${style.tone}-ink)` : "var(--color-muted)"}>
						{#if Icon}<Icon size={16} aria-hidden="true" />{:else}<ArrowUpRight size={16} aria-hidden="true" />{/if}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm/5 font-medium">{reference.label}</span>
						<span class="text-muted block truncate text-xs leading-4">Opportunity{name && name !== reference.label ? ` · ${name}` : ""}</span>
					</span>
				</a>
			{/if}
			{#if remove}
				<button
					type="button"
					class="control absolute top-1.5 -right-1.5 z-10 pointer-fine:opacity-0 pointer-fine:group-hover/ref:opacity-100 pointer-fine:focus-visible:opacity-100"
					data-variant="ghost"
					data-size="sm"
					data-icon
					aria-label={`Remove reference ${reference.label}`}
					title="Remove reference"
					onclick={() => remove!(reference)}><X size={13} aria-hidden="true" /></button>
			{/if}
		</li>
	{/each}
</ul>

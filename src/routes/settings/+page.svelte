<script lang="ts">
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { Building2, Clock3, ListChecks, Tags } from "@lucide/svelte";
	const sections = [
		{ id: "general", label: "General" },
		{ id: "pipeline", label: "Pipeline" },
		{ id: "registry", label: "Client registry" },
	] as const;
	let section = $derived(sections.find((entry) => entry.id === page.url.searchParams.get("section"))?.id ?? "general");
	let businessName = $state("Meadow Lane Realty & Development");
	let timezone = $state("");
	let dateFormat = $state("MMM d, yyyy");
	let opportunityType = $state("Buyer");
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	const stages = ["New lead", "Active lead", "Under contract", "Closed"];
</script>

<svelte:head><title>Settings · Meadow Lane</title></svelte:head>

<nav aria-label="Settings sections" class="border-hairline flex gap-7 overflow-x-auto border-b px-5 sm:px-8 lg:px-10">
	{#each sections as entry (entry.id)}<a href={`/settings?section=${entry.id}`} aria-current={section === entry.id ? "page" : undefined} class="text-muted hover:text-ink aria-[current=page]:border-ink aria-[current=page]:text-ink min-h-8 shrink-0 border-b-2 border-transparent pb-1 text-sm font-medium transition-colors"
			>{entry.label}</a
		>{/each}
</nav>

<div class="surface-content">
	{#if section === "general"}
		<div class="max-w-3xl">
			<div class="flex items-start gap-3">
				<span class="bg-info-soft text-info flex size-12 shrink-0 items-center justify-center rounded-xl"><Building2 size={22} aria-hidden="true" /></span>
				<div>
					<h2 class="font-display text-2xl/7 tracking-tight">Business preferences</h2>
					<p class="text-muted mt-0.5 text-sm">Shared by everyone at Meadow Lane.</p>
				</div>
			</div>
			<div class="mt-8 grid gap-6 sm:grid-cols-2">
				<div class="sm:col-span-2"><label for="business-name" class="mb-2 block text-sm font-medium">Business name</label><input id="business-name" class="field" disabled={!ready} bind:value={businessName} /></div>
				<div>
					<label for="timezone" class="mb-2 block text-sm font-medium">Timezone</label><input id="timezone" class="field" disabled={!ready} bind:value={timezone} placeholder="e.g. America/Chicago" />
					<p class="text-muted mt-2 text-xs">Used for due dates and shared schedules.</p>
				</div>
				<div><label for="date-format" class="mb-2 block text-sm font-medium">Date format</label><select id="date-format" class="field" disabled={!ready} bind:value={dateFormat}><option>MMM d, yyyy</option><option>MM/dd/yyyy</option><option>dd/MM/yyyy</option></select></div>
				<div>
					<label for="currency" class="mb-2 block text-sm font-medium">Currency</label><input id="currency" class="field" value="USD · US dollar" readonly />
					<p class="text-muted mt-2 text-xs">Currency is fixed for this workspace.</p>
				</div>
			</div>
			<div class="border-hairline mt-8 flex items-start justify-between gap-5 border-y py-6">
				<div>
					<h3 class="font-medium">Realtor tasks</h3>
					<p class="text-muted mt-2 max-w-lg text-sm leading-6">Show assigned work on the dashboard, in the attention view, and on linked records. Turning this off will keep existing tasks.</p>
				</div>
				<input type="checkbox" aria-label="Enable realtor tasks" checked disabled class="mt-1 size-5" title="Task settings are not connected yet" />
			</div>
			<div class="mt-6 flex flex-wrap items-center gap-4">
				<button type="button" class="control" data-variant="primary" disabled>Save changes</button>
				<p class="text-muted text-xs">Saving settings is not available yet.</p>
			</div>
		</div>
	{:else if section === "pipeline"}
		<div class="max-w-3xl">
			<div class="flex items-start gap-3">
				<span class="bg-pending-soft text-pending flex size-12 shrink-0 items-center justify-center rounded-xl"><ListChecks size={22} aria-hidden="true" /></span>
				<div>
					<h2 class="font-display text-2xl/7 tracking-tight">Checklist defaults</h2>
					<p class="text-muted mt-0.5 text-sm">Four opportunity types. Four stages. Sixteen templates.</p>
				</div>
			</div>
			<div class="mt-8 max-w-sm"><label for="template-type" class="mb-2 block font-medium">Opportunity type</label><select id="template-type" class="field" disabled={!ready} bind:value={opportunityType}><option>Buyer</option><option>Seller</option><option>Estate Sale</option><option>Construction</option></select></div>
			<ul class="divide-hairline mt-6 divide-y">
				{#each stages as stage (stage)}<li class="flex items-center justify-between gap-4 py-5">
						<div>
							<h3 class="font-medium">{stage}</h3>
							<p class="text-muted mt-1 text-xs">{opportunityType} checklist template</p>
						</div>
						<button type="button" class="control" disabled aria-label={`Edit ${opportunityType} ${stage} template`}>Edit template</button>
					</li>{/each}
			</ul>
			<div class="border-hairline mt-8 border-t pt-6">
				<div class="flex items-center gap-2">
					<Clock3 size={17} class="text-muted" aria-hidden="true" />
					<h3 class="font-medium">Checklist attention</h3>
				</div>
				<p class="text-muted mt-2 text-sm leading-6">Choose whether overdue work is shown across all visited stages or only the current stage.</p>
				<label for="attention-scope" class="sr-only">Checklist attention scope</label><select id="attention-scope" class="field mt-4 max-w-sm" disabled><option>All visited stages</option><option>Current stage only</option></select>
			</div>
		</div>
	{:else}
		<div class="max-w-3xl">
			<div class="flex items-start gap-3">
				<span class="bg-tour-soft text-tour flex size-12 shrink-0 items-center justify-center rounded-xl"><Tags size={22} aria-hidden="true" /></span>
				<div>
					<h2 class="font-display text-2xl/7 tracking-tight">Client tags</h2>
					<p class="text-muted mt-0.5 text-sm">A shared vocabulary for your relationships.</p>
				</div>
			</div>
			<ul class="divide-hairline mt-8 divide-y">
				{#each [{ name: "sphere", description: "People in your wider network.", color: "info" }, { name: "nurture", description: "Relationships worth staying in touch with.", color: "tour" }, { name: "referral", description: "Clients referred to the business.", color: "pending" }] as tag (tag.name)}<li
						class="flex items-center justify-between gap-4 py-5">
						<div>
							<span class="inline-block rounded-md px-2.5 py-1 text-xs font-medium" style:background-color={`var(--color-${tag.color}-soft)`} style:color={`var(--color-${tag.color})`}>{tag.name}</span>
							<p class="text-muted mt-2 text-sm">{tag.description}</p>
						</div>
						<button type="button" class="control" disabled aria-label={`Manage ${tag.name} tag`}>Manage</button>
					</li>{/each}
			</ul>
			<button type="button" class="control mt-6" disabled>Add tag</button>
		</div>
	{/if}
</div>

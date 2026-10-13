<script lang="ts">
	import { opportunities } from "#lib/shell/fixtures.js";
	let search = $state("");
	let filtered = $derived(opportunities.filter((opportunity) => `${opportunity.client} ${opportunity.title}`.toLowerCase().includes(search.toLowerCase())));
</script>

<svelte:head><title>Registry · Meadow Lane</title></svelte:head>

<div class="surface-content">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<p class="text-muted max-w-lg">Clients and their linked opportunities.</p>
		<button type="button" class="control" disabled title="Client creation is not implemented yet">New client</button>
	</div>
	<div class="max-w-sm"><label for="client-search" class="mb-2 block font-medium">Search clients</label><input id="client-search" type="search" bind:value={search} class="field" placeholder="Name or opportunity" /></div>
	<!-- Keyboard users must be able to scroll the wide preview table. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div role="region" aria-label="Client registry" tabindex="0" class="border-hairline mt-6 overflow-x-auto rounded-xl border bg-white">
		<table class="w-full min-w-140 text-left text-sm">
			<thead class="border-hairline bg-canvas text-muted border-b text-xs"><tr><th scope="col" class="px-5 py-4 font-medium">Client</th><th scope="col" class="px-5 py-4 font-medium">Linked opportunity</th><th scope="col" class="px-5 py-4 font-medium">Stage</th></tr></thead><tbody class="divide-hairline divide-y">
				{#each filtered as opportunity (opportunity.id)}<tr><th scope="row" class="px-5 py-5 font-medium">{opportunity.client}</th><td class="px-5 py-5"><a href="/pipeline" class="text-field-deep underline-offset-4 hover:underline">{opportunity.title}</a></td><td class="text-muted px-5 py-5">{opportunity.stage}</td></tr
					>{/each}
			</tbody>
		</table>
		{#if filtered.length === 0}<p class="text-muted p-5" role="status">No clients match “{search}”. Try another name.</p>{/if}
	</div>
</div>

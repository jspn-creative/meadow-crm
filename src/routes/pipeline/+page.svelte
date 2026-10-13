<script lang="ts">
	import { stages, opportunities } from "#lib/shell/fixtures.js";
</script>

<svelte:head><title>Pipeline · Meadow Lane</title></svelte:head>

<div class="surface-content">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<p class="text-muted max-w-lg">Four stages, one shared board.</p>
		<button type="button" class="control" disabled title="Opportunity creation is not implemented yet">New opportunity</button>
	</div>
	<div class="grid gap-5 pb-4 lg:grid-cols-4">
		{#each stages as stage (stage)}
			<section aria-label={stage} class="min-w-0">
				<h2 class="border-hairline mb-4 flex items-center justify-between border-b pb-3 text-sm font-medium">{stage}<span class="text-muted text-xs">1</span></h2>
				{#each opportunities.filter((opportunity) => opportunity.stage === stage) as opportunity (opportunity.id)}
					<article class="border-hairline rounded-xl border bg-white p-5">
						<span class={["inline-block rounded-md px-2 py-1 text-xs", opportunity.tone === "info" && "bg-info-soft text-info", opportunity.tone === "tour" && "bg-tour-soft text-tour", opportunity.tone === "pending" && "bg-pending-soft text-pending", opportunity.tone === "success" && "bg-success-soft text-success"]}
							>{opportunity.type}</span>
						<h3 class="mt-4 font-medium">{opportunity.title}</h3>
						<p class="text-muted mt-1 text-xs">{opportunity.client}</p>
						<dl class="mt-5 space-y-2 text-xs">
							<div class="flex justify-between gap-2">
								<dt class="text-muted">Timeline</dt>
								<dd>{opportunity.timeline}</dd>
							</div>
							<div class="flex justify-between gap-2">
								<dt class="text-muted">Checklist</dt>
								<dd>{opportunity.progress}</dd>
							</div>
						</dl>
					</article>
				{/each}
			</section>
		{/each}
	</div>
</div>

<script lang="ts">
	import { ArrowUpRight } from "@lucide/svelte";
	let { label, value, detail, color = "success", href = "/pipeline" }: { label: string; value: number; detail: string; color?: "info" | "pending" | "tour" | "success"; href?: string } = $props();
</script>

<a {href} data-interactive="score" style:--item-hue={`var(--color-${color}-soft)`} style:--item-ink={`var(--color-${color})`} class="group widget-card p-(--card-pad)">
	<h2 class="text-muted text-xs leading-4 font-medium">{label}</h2>
	<div class="mt-2 flex items-center justify-between gap-2">
		<p class="font-display text-4xl leading-8 tracking-tight tabular-nums">{value}</p>
		<span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--item-hue) text-(--item-ink)"><ArrowUpRight size={14} aria-hidden="true" /></span>
	</div>
	<p class="text-muted mt-1 text-xs leading-5">{detail}</p>
</a>

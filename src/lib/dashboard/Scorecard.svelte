<script lang="ts">
	import { ArrowUpRight } from "@lucide/svelte";
	let { label, value, detail, color = "success", href = "/pipeline" }: { label: string; value: number; detail: string; color?: "info" | "pending" | "tour" | "success"; href?: string } = $props();
</script>

<a {href} data-surface="framed" style:--surface-frame={`var(--color-${color}-soft)`} style:--item-hue={`var(--color-${color}-soft)`} style:--item-ink={`var(--color-${color})`} class="surface score group relative isolate min-w-0 p-(--card-pad)">
	<h2 class="text-muted text-xs leading-4 font-medium">{label}</h2>
	<div class="mt-2 flex items-center justify-between gap-2">
		<p class="font-display text-4xl leading-8 tracking-tight tabular-nums">{value}</p>
		<span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-(--item-hue) text-(--item-ink)"><ArrowUpRight size={14} aria-hidden="true" /></span>
	</div>
	<p class="text-muted mt-1 text-xs leading-5">{detail}</p>
</a>

<style>
	/* The stage's soft tint washes in from the top-left and settles into the surface, running under the border so the frame and fill read as one card. */
	.score {
		--surface-edge: color-mix(in oklab, var(--item-ink) 22%, transparent);
		border-color: color-mix(in oklab, var(--item-ink) 18%, transparent);
		background: linear-gradient(135deg, var(--item-hue), var(--color-white) 85%) border-box;
		transition:
			transform 360ms var(--ease-shell),
			box-shadow 360ms var(--ease-shell);
		&::before {
			content: "";
			position: absolute;
			inset: -1px;
			z-index: -1;
			border-radius: inherit;
			pointer-events: none;
			background: linear-gradient(135deg, color-mix(in oklab, var(--item-ink) 14%, var(--item-hue)), var(--color-white) 85%);
			opacity: 0;
			transition: opacity 360ms ease;
		}
		&:focus-visible::before {
			opacity: 1;
		}
		@media (hover: hover) and (pointer: fine) {
			&:hover::before {
				opacity: 1;
			}
			@media (prefers-reduced-motion: no-preference) {
				&:hover {
					transform: translateY(-2px);
					box-shadow:
						0 0 0 3px var(--surface-frame),
						0 0 0 4px var(--surface-edge, var(--color-hairline)),
						var(--shadow-floating);
				}
			}
		}
		@media (prefers-reduced-motion: reduce) {
			transition: none;
			&::before {
				transition: none;
			}
		}
	}
</style>

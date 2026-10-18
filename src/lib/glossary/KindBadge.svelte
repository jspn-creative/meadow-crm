<script lang="ts">
	import { Info } from "@lucide/svelte";
	import { kindDescriptions, type Kind } from "./vocabulary.ts";

	let { kind, align = "start" }: { kind: Kind; align?: "start" | "end" } = $props();
	const id = $props.id();
	const tone: Partial<Record<Kind, string>> = {
		Module: "bg-info-soft text-info",
		View: "bg-tour-soft text-tour",
		Widget: "bg-tour-soft text-tour",
		Record: "bg-success-soft text-success",
		Status: "bg-urgent-soft text-urgent",
		Action: "bg-pending-soft text-pending",
	};
</script>

<!-- The info mark says there is more to read; hover, keyboard focus, or a tap reveals it, and Escape dismisses it. -->
<span class="group/kind relative inline-flex">
	<button
		type="button"
		aria-describedby={`${id}-tip`}
		class={["text-2xs inline-flex cursor-help items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2 leading-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-field)", tone[kind] ?? "bg-paper text-muted"]}
		onkeydown={(event) => {
			if (event.key === "Escape") event.currentTarget.blur();
		}}>
		{kind}
		<Info size={11} strokeWidth={2.2} class="opacity-60 transition-opacity group-hover/kind:opacity-100" aria-hidden="true" />
	</button>
	<span
		id={`${id}-tip`}
		role="tooltip"
		class={[
			"bg-ink shadow-panel pointer-events-none invisible absolute top-full z-30 mt-2 w-56 rounded-lg px-3 py-2 text-xs/5 font-normal tracking-normal text-white normal-case opacity-0 transition-opacity duration-150 group-focus-within/kind:visible group-focus-within/kind:opacity-100 group-hover/kind:visible group-hover/kind:opacity-100 motion-reduce:transition-none",
			align === "end" ? "right-0" : "left-0",
		]}>
		<span class="font-medium">{kind}:</span>
		{kindDescriptions[kind]}
	</span>
</span>

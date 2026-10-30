<script lang="ts">
	import { Info } from "@lucide/svelte";
	import { kindDescriptions, type Kind } from "./vocabulary.ts";

	let { kind, align = "start" }: { kind: Kind; align?: "start" | "end" } = $props();
	const id = $props.id();
</script>

<!-- The info mark says there is more to read; hover, keyboard focus, or a tap reveals it, and Escape dismisses it. -->
<span class="group/kind relative inline-flex">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions (The informational chip is focusable so keyboard users can read and dismiss its tooltip.) -->
	<span
		tabindex="0"
		aria-describedby={`${id}-tip`}
		class="chip cursor-help"
		onkeydown={(event) => {
			if (event.key === "Escape") event.currentTarget.blur();
		}}>
		{kind}
		<Info size={11} strokeWidth={2.2} class="opacity-60 transition-opacity group-hover/kind:opacity-100" aria-hidden="true" />
	</span>
	<span
		id={`${id}-tip`}
		role="tooltip"
		class={[
			"surface surface-floating pointer-events-none invisible absolute top-full z-30 mt-2 w-56 px-3 py-2 text-xs/5 font-normal tracking-normal normal-case opacity-0 transition-opacity duration-150 group-focus-within/kind:visible group-focus-within/kind:opacity-100 group-hover/kind:visible group-hover/kind:opacity-100 motion-reduce:transition-none",
			align === "end" ? "right-0" : "left-0",
		]}>
		<span class="font-medium">{kind}:</span>
		{kindDescriptions[kind]}
	</span>
</span>

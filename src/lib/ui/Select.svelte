<script lang="ts" module>
	export type SelectOption<T extends string = string> = { value: T; label: string; disabled?: boolean };

	/** Options from a label record such as `stageLabels`, keeping its keys' type. */
	export function optionsFrom<T extends string>(labels: Readonly<Record<T, string>>): SelectOption<T>[] {
		return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
	}
</script>

<script lang="ts" generics="T extends string">
	import type { ClassValue } from "svelte/elements";

	// A native select with the shared chevron indicator; the browser keeps its own picker. Every select in the app uses it, so the indicator never falls back to the cramped native arrow.
	let {
		value = $bindable(),
		options,
		label,
		id,
		appearance = "field",
		dot,
		active = false,
		disabled = false,
		required = false,
		class: className,
		onchange,
	}: {
		value: T;
		options: readonly SelectOption<T>[];
		/** The accessible name, when no visible label points at `id`. */
		label?: string;
		id?: string;
		/** A form field, or a compact pill for filters and inline record values. */
		appearance?: "field" | "pill";
		/** A colour shown as a leading dot, such as a stage tone. */
		dot?: string;
		/** A pill filter set to anything other than its default. */
		active?: boolean;
		disabled?: boolean;
		required?: boolean;
		class?: ClassValue;
		onchange?: (value: T) => void;
	} = $props();
</script>

<span class={["select", className]}>
	<select {id} class={[appearance === "pill" ? "select-pill" : "field", dot && "pl-7"]} aria-label={label} data-active={appearance === "pill" ? String(active) : undefined} {disabled} {required} bind:value onchange={() => onchange?.(value)}>
		{#each options as option (option.value)}<option value={option.value} disabled={option.disabled}>{option.label}</option>{/each}
	</select>
	{#if dot}<span class="pointer-events-none absolute top-1/2 left-3 z-1 size-2 -translate-y-1/2 rounded-full" style:background={dot} aria-hidden="true"></span>{/if}
</span>

<script lang="ts">
	import { tick, type Snippet } from "svelte";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import type { SelectOption } from "./Select.svelte";

	let { values = $bindable([]), options, label, placeholder = "Start typing…", disabled = false, chipIcon }: { values: string[]; options: readonly SelectOption[]; label: string; placeholder?: string; disabled?: boolean; chipIcon?: Snippet } = $props();
	const id = $props.id();
	let root: HTMLDivElement;
	let field: HTMLDivElement;
	let input = $state<HTMLInputElement>();
	let popup = $state<HTMLElement>();
	let query = $state("");
	let open = $state(false);
	let active = $state(0);
	let placement = $state("");
	let indexed = $derived(options.map((option) => ({ ...option, search: option.label.toLocaleLowerCase() })));
	let chosen = $derived(new Set(values));
	let byValue = $derived(new Map(options.map((option) => [option.value, option])));
	let selected = $derived(
		values.flatMap((value) => {
			const option = byValue.get(value);
			return option ? [option] : [];
		}),
	);
	let matches = $derived.by(() => {
		const term = query.trim().toLocaleLowerCase();
		return indexed.filter((option) => !option.disabled && !chosen.has(option.value) && option.search.includes(term));
	});
	let activeOption = $derived(matches[active]);

	function close() {
		popup?.hidePopover();
		open = false;
		active = 0;
	}

	function show() {
		if (!input || !popup || disabled || input.matches(":disabled")) return;
		const rect = field.getBoundingClientRect();
		const below = innerHeight - rect.bottom - 12;
		const above = rect.top - 12;
		const limit = 16 * parseFloat(getComputedStyle(document.documentElement).fontSize);
		const height = Math.max(0, Math.min(limit, Math.max(below, above)));
		const upward = below < Math.min(limit, above);
		const top = upward ? rect.top - 4 : rect.bottom + 4;
		placement = `position-area:none;inset:auto;margin:0;left:${rect.left}px;top:${top}px;width:${rect.width}px;max-height:${height}px;transform:${upward ? "translateY(-100%)" : "none"}`;
		popup.showPopover();
		open = true;
	}

	function choose(value: string) {
		if (disabled || input?.matches(":disabled")) return;
		if (!chosen.has(value)) values = [...values, value];
		query = "";
		input?.focus();
		close();
	}

	async function remove(value: string) {
		values = values.filter((item) => item !== value);
		active = 0;
		input?.focus();
		await tick();
		if (open) show();
	}

	function dismissOutside(event: PointerEvent | FocusEvent) {
		if (open && event.target instanceof Node && !root.contains(event.target)) close();
	}

	async function navigate(event: KeyboardEvent) {
		if (event.isComposing) return;
		if (event.key === "Escape" && open) {
			event.preventDefault();
			event.stopPropagation();
			close();
		} else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
			if (!open && (event.key === "Home" || event.key === "End")) return;
			event.preventDefault();
			const wasOpen = open;
			show();
			if (!matches.length) return;
			active = event.key === "Home" ? 0 : event.key === "End" ? matches.length - 1 : !wasOpen ? (event.key === "ArrowUp" ? matches.length - 1 : 0) : Math.max(0, Math.min(matches.length - 1, active + (event.key === "ArrowDown" ? 1 : -1)));
			await tick();
			const option = document.getElementById(`${id}-option-${active}`);
			if (option && popup) {
				// Adjust only the suggestions' scroll position, not the opportunity dialog's.
				const bounds = popup.getBoundingClientRect();
				const item = option.getBoundingClientRect();
				if (item.top < bounds.top) popup.scrollTop -= bounds.top - item.top;
				else if (item.bottom > bounds.top + popup.clientHeight) popup.scrollTop += item.bottom - bounds.top - popup.clientHeight;
			}
		} else if (event.key === "Enter") {
			event.preventDefault();
			if (open && activeOption) choose(activeOption.value);
			else show();
		} else if (event.key === "Tab") close();
	}
</script>

<svelte:window onresize={close} />
<svelte:document onpointerdown={dismissOutside} onfocusin={dismissOutside} />

<div bind:this={root} class="relative min-w-0">
	<label for={`${id}-input`} class="text-muted mb-1.5 block text-xs font-medium">{label}</label>
	<div bind:this={field} class="field-group flex-wrap">
		{#each selected as option (option.value)}
			<span class="chip max-w-full min-w-0">
				{#if chipIcon}{@render chipIcon()}{/if}
				<span class="min-w-0 wrap-anywhere">{option.label}</span><button type="button" class="chip-remove shrink-0" aria-label={`Remove ${option.label}`} {disabled} onclick={() => remove(option.value)}>×</button>
			</span>
		{/each}
		<input
			bind:this={input}
			id={`${id}-input`}
			type="text"
			role="combobox"
			class="field-bare basis-28"
			aria-autocomplete="list"
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-controls={`${id}-list`}
			aria-activedescendant={open && activeOption ? `${id}-option-${active}` : undefined}
			autocomplete="off"
			{placeholder}
			{disabled}
			value={query}
			onkeydown={navigate}
			onfocus={show}
			onclick={show}
			oninput={(event) => {
				query = event.currentTarget.value;
				active = 0;
				show();
				if (popup) popup.scrollTop = 0;
			}} />
	</div>
	<div
		bind:this={popup}
		popover="manual"
		class="surface surface-floating menu fixed max-h-64 min-w-0 overflow-y-auto overscroll-contain"
		style={placement}
		{@attach overflowFade({ axis: "y" })}
		{@attach (node) => {
			const onscroll = (event: Event) => {
				if (open && event.target instanceof Node && !node.contains(event.target)) close();
			};
			document.addEventListener("scroll", onscroll, true);
			return () => document.removeEventListener("scroll", onscroll, true);
		}}
		ontoggle={(event) => {
			open = event.newState === "open";
			if (!open) active = 0;
		}}>
		<div id={`${id}-list`} role="listbox" aria-label={label} aria-multiselectable="true">
			{#if open}
				{#each matches as option, index (option.value)}
					<button type="button" id={`${id}-option-${index}`} role="option" aria-selected={chosen.has(option.value)} tabindex="-1" class="menu-item" data-active={index === active} {disabled} onpointerdown={(event) => event.preventDefault()} onclick={() => choose(option.value)}>{option.label}</button>
				{/each}
			{/if}
		</div>
		{#if open && !matches.length}<p role="status" class="text-muted p-3 text-sm">{!options.length ? "No clients available. You can save without a client." : options.every((option) => chosen.has(option.value)) ? "All clients selected." : "No matching clients."}</p>{/if}
	</div>
	<span class="sr-only" role="status">{open ? `${matches.length} ${matches.length === 1 ? "match" : "matches"} available.` : ""}</span>
</div>

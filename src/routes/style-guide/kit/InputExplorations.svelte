<script lang="ts">
	import Select from "#lib/ui/Select.svelte";
	const id = $props.id();
	let files = $state<File[]>([]);
	let fileInput: HTMLInputElement;
	let fileMessage = $state("No files selected.");
	let rejected = $state<string[]>([]);
	let dragDepth = $state(0);
	const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

	// All three entry points use the same fixture-only validation; nothing leaves the browser.
	function receiveFiles(incoming: FileList | File[]) {
		const next = [...files];
		const failures: string[] = [];
		let added = 0;
		for (const file of Array.from(incoming)) {
			let reason = "";
			if (!/\.(png|jpe?g|pdf)$/i.test(file.name)) reason = "Choose PNG, JPEG or PDF.";
			else if (file.size > 2 * 1024 * 1024) reason = "The demo limit is 2 MiB per file.";
			else if (next.some((existing) => fileKey(existing) === fileKey(file))) reason = "Already selected.";
			else if (next.length >= 3) reason = "The demo holds at most three files.";
			if (reason) failures.push(`${file.name}: ${reason}`);
			else {
				next.push(file);
				added += 1;
			}
		}
		files = next;
		rejected = failures;
		fileMessage = `${added} added; ${failures.length} rejected. ${next.length} selected locally.`;
	}

	type Choice = { id: string; label: string; color: string };
	type Picker = "combo" | "tags";
	const choices: Choice[] = [
		{ id: "violet", label: "Violet", color: "var(--color-tour)" },
		{ id: "sage", label: "Sage", color: "var(--color-success)" },
		{ id: "clay", label: "Clay", color: "var(--color-urgent)" },
		{ id: "butter", label: "Butter", color: "var(--color-pending)" },
		{ id: "sky", label: "Sky", color: "var(--color-info)" },
	];
	let selectedChoice = $state("sage");
	let tagIds = $state<string[]>(["violet"]);
	let tagMessage = $state("");
	let pickers = $state({ combo: { open: false, query: "", active: 0 }, tags: { open: false, query: "", active: 0 } });
	let comboRoot: HTMLDivElement;
	let tagsRoot: HTMLDivElement;
	let comboInput: HTMLInputElement;
	let tagsInput: HTMLInputElement;
	const options = (kind: Picker) => choices.filter((choice) => (kind !== "tags" || !tagIds.includes(choice.id)) && choice.label.toLowerCase().includes(pickers[kind].query.toLowerCase()));
	function setTags(next: string[]) {
		tagIds = next.filter((value, index) => choices.some((choice) => choice.id === value) && next.indexOf(value) === index);
	}
	function choose(kind: Picker, choice: Choice) {
		if (kind === "combo") selectedChoice = choice.id;
		else {
			setTags([...tagIds, choice.id]);
			tagMessage = `${choice.label} added.`;
		}
		pickers[kind] = { open: false, query: "", active: 0 };
		(kind === "combo" ? comboInput : tagsInput)?.focus();
	}
	function pickerKey(event: KeyboardEvent, kind: Picker) {
		const state = pickers[kind];
		const matches = options(kind);
		if (event.key === "Escape") {
			state.open = false;
			return;
		}
		if (event.key === "Tab") {
			state.open = false;
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			if (state.open && matches[state.active]) choose(kind, matches[state.active]);
			else state.open = true;
			return;
		}
		if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
		if (!state.open && (event.key === "Home" || event.key === "End")) return;
		event.preventDefault();
		const wasOpen = state.open;
		state.open = true;
		state.active = event.key === "Home" ? 0 : event.key === "End" ? Math.max(0, matches.length - 1) : !wasOpen ? (event.key === "ArrowUp" ? Math.max(0, matches.length - 1) : 0) : Math.max(0, Math.min(matches.length - 1, state.active + (event.key === "ArrowDown" ? 1 : -1)));
	}
	function dismissOutside(event: PointerEvent | FocusEvent) {
		if (!(event.target instanceof Node)) return;
		if (!comboRoot?.contains(event.target)) pickers.combo.open = false;
		if (!tagsRoot?.contains(event.target)) pickers.tags.open = false;
	}

	const items = Array.from({ length: 11 }, (_, index) => ({ id: `sample-${index + 1}`, label: `Sample ${String(index + 1).padStart(2, "0")}` }));
	let empty = $state(false);
	let pageSize = $state(3);
	let requestedPage = $state(1);
	let pageItems = $derived(empty ? [] : items);
	let pageCount = $derived(Math.ceil(pageItems.length / pageSize));
	let page = $derived(pageCount === 0 ? 0 : Math.max(1, Math.min(requestedPage, pageCount)));
	let visibleItems = $derived(pageItems.slice(Math.max(0, page - 1) * pageSize, page * pageSize));
	function changePageSize(value: number) {
		requestedPage = Math.max(1, Math.min(page || 1, Math.ceil(pageItems.length / value)));
		pageSize = value;
	}
	let progress = $state(40);
	let indeterminate = $state(false);
	let radioValue = $state("comfortable");
</script>

<svelte:document onpointerdown={dismissOutside} onfocusin={dismissOutside} />

<div class="@container/input-explorations min-w-0 space-y-6">
	<p class="text-muted text-sm">Interactive fixtures only. Values reset when this component is remounted; nothing is uploaded or saved.</p>
	<div class="grid min-w-0 gap-6 @3xl/input-explorations:grid-cols-2">
		<div class="border-hairline min-w-0 space-y-3 rounded-2xl border bg-white p-4">
			<h3 class="font-semibold">Attachment</h3>
			<p id={`${id}-file-help`} class="text-muted text-sm">Local selection demo: PNG, JPEG or PDF, up to 2 MiB each, three files maximum. Choose or drop files, or paste files while Choose local files has focus.</p>
			<div
				role="group"
				aria-label="Local file selection"
				aria-describedby={`${id}-file-help`}
				data-dragging={dragDepth > 0}
				class="border-hairline bg-canvas data-[dragging=true]:border-field data-[dragging=true]:bg-success-soft rounded-xl border-2 border-dashed p-4"
				ondragenter={(event) => {
					if (event.dataTransfer?.types.includes("Files")) {
						event.preventDefault();
						dragDepth += 1;
					}
				}}
				ondragover={(event) => {
					event.preventDefault();
				}}
				ondragleave={() => {
					dragDepth = Math.max(0, dragDepth - 1);
				}}
				ondrop={(event) => {
					event.preventDefault();
					dragDepth = 0;
					if (event.dataTransfer) receiveFiles(event.dataTransfer.files);
				}}
				onpaste={(event) => {
					if (event.clipboardData?.files.length) {
						event.preventDefault();
						receiveFiles(event.clipboardData.files);
					}
				}}>
				<input
					bind:this={fileInput}
					type="file"
					accept=".png,.jpg,.jpeg,.pdf"
					multiple
					class="hidden"
					onchange={(event) => {
						if (event.currentTarget.files) receiveFiles(event.currentTarget.files);
						event.currentTarget.value = "";
					}} />
				<button type="button" class="control" onclick={() => fileInput.click()}>Choose local files</button>
				<p class="text-muted mt-2 text-xs">Files stay in memory. Removing one lets you select it again.</p>
			</div>
			<ul class="space-y-2">
				{#each files as file (fileKey(file))}
					<li class="bg-paper/50 flex min-w-0 items-center gap-2 rounded-xl p-2">
						<span class="min-w-0 flex-1 text-sm break-all">{file.name} <span class="text-muted">({Math.ceil(file.size / 1024)} KiB)</span></span><button
							type="button"
							class="control shrink-0"
							aria-label={`Remove ${file.name}`}
							onclick={() => {
								files = files.filter((candidate) => candidate !== file);
								fileMessage = `${file.name} removed. ${files.length} selected locally.`;
							}}>Remove</button>
					</li>
				{/each}
			</ul>
			<p role="status" class="text-muted text-xs">{fileMessage}</p>
			{#if rejected.length}<ul class="text-urgent space-y-1 text-xs">
					{#each rejected as message, index (`${index}-${message}`)}<li>{message}</li>{/each}
				</ul>{/if}
		</div>

		<div class="border-hairline min-w-0 space-y-3 rounded-2xl border bg-white p-4">
			<h3 class="font-semibold">Combobox</h3>
			<p class="text-muted text-sm">Search a fixed fixture palette. Arrows, Home/End, Enter and Escape work while the list is open.</p>
			<div bind:this={comboRoot} class="relative">
				<label for={`${id}-combo-input`} class="mb-2 block text-xs font-medium">Choose one sample color</label>
				<input
					bind:this={comboInput}
					id={`${id}-combo-input`}
					class="field"
					role="combobox"
					aria-expanded={pickers.combo.open}
					aria-controls={`${id}-combo-list`}
					aria-autocomplete="list"
					aria-activedescendant={pickers.combo.open && options("combo")[pickers.combo.active] ? `${id}-combo-${options("combo")[pickers.combo.active].id}` : undefined}
					placeholder={choices.find((choice) => choice.id === selectedChoice)?.label}
					value={pickers.combo.query}
					onfocus={() => {
						pickers.combo.open = true;
					}}
					onclick={() => {
						pickers.combo.open = true;
					}}
					oninput={(event) => {
						pickers.combo.query = event.currentTarget.value;
						pickers.combo.active = 0;
						pickers.combo.open = true;
					}}
					onkeydown={(event) => pickerKey(event, "combo")} />
				{@render suggestionList("combo")}
			</div>
			<p role="status" class="text-muted text-xs">Selected: {choices.find((choice) => choice.id === selectedChoice)?.label}</p>
		</div>

		<div class="border-hairline min-w-0 space-y-3 rounded-2xl border bg-white p-4">
			<h3 class="font-semibold">Controlled tag input</h3>
			<p id={`${id}-tags-help`} class="text-muted text-sm">Fixed color suggestions, not business tags. The demo controller owns the selected IDs; no freeform creation.</p>
			<div bind:this={tagsRoot} class="relative">
				<label for={`${id}-tags-input`} class="mb-2 block text-xs font-medium">Sample colors</label>
				<div class="field-group flex-wrap">
					{#each tagIds as tagId (tagId)}
						{@const tag = choices.find((choice) => choice.id === tagId)!}
						<span class="chip" data-dot style:--dot={tag.color}
							>{tag.label}<button
								type="button"
								class="chip-remove"
								aria-label={`Remove ${tag.label}`}
								onclick={() => {
									setTags(tagIds.filter((value) => value !== tagId));
									tagMessage = `${tag.label} removed.`;
									tagsInput?.focus();
								}}>×</button
							></span>
					{/each}
					<input
						bind:this={tagsInput}
						id={`${id}-tags-input`}
						class="field-bare basis-28"
						role="combobox"
						aria-expanded={pickers.tags.open}
						aria-controls={`${id}-tags-list`}
						aria-describedby={`${id}-tags-help`}
						aria-autocomplete="list"
						aria-activedescendant={pickers.tags.open && options("tags")[pickers.tags.active] ? `${id}-tags-${options("tags")[pickers.tags.active].id}` : undefined}
						placeholder="Find a color…"
						value={pickers.tags.query}
						onfocus={() => {
							pickers.tags.open = true;
						}}
						onclick={() => {
							pickers.tags.open = true;
						}}
						oninput={(event) => {
							pickers.tags.query = event.currentTarget.value;
							pickers.tags.active = 0;
							pickers.tags.open = true;
						}}
						onkeydown={(event) => pickerKey(event, "tags")} />
				</div>
				{@render suggestionList("tags")}
			</div>
			<button
				type="button"
				class="control"
				onclick={() => {
					setTags(["violet"]);
					tagMessage = "Controller reset to Violet.";
					pickers.tags = { open: false, query: "", active: 0 };
				}}>Reset from controller</button>
			<p class="text-muted font-mono text-xs break-all">Selected IDs: {JSON.stringify(tagIds)}</p>
			<p role="status" class="text-muted text-xs">{tagMessage}</p>
		</div>

		<div class="border-hairline min-w-0 space-y-3 rounded-2xl border bg-white p-4">
			<h3 class="font-semibold">Pagination</h3>
			<div class="flex flex-wrap items-center gap-3 text-xs">
				<label class="flex items-center gap-2">Per page<Select value={String(pageSize)} options={["3", "5", "10"].map((value) => ({ value, label: value }))} onchange={(value) => changePageSize(Number(value))} /></label><label class="flex items-center gap-2"
					><input
						type="checkbox"
						class="check"
						checked={empty}
						onchange={(event) => {
							requestedPage = page || 1;
							empty = event.currentTarget.checked;
						}} />Empty fixture</label>
			</div>
			<ul class="divide-hairline bg-canvas divide-y rounded-xl px-3">
				{#each visibleItems as item (item.id)}<li class="py-3 text-sm">{item.label}</li>{:else}<li class="text-muted py-3 text-sm">No samples to display.</li>{/each}
			</ul>
			<nav aria-label="Sample pagination" class="flex flex-wrap items-center gap-1">
				<button
					type="button"
					class="control"
					disabled={page <= 1}
					onclick={() => {
						requestedPage = page - 1;
					}}>Previous</button
				>{#each Array.from({ length: pageCount }, (_, index) => index + 1) as number (number)}<button
						type="button"
						class="control"
						data-variant={number === page ? "primary" : undefined}
						aria-label={`Page ${number}`}
						aria-current={number === page ? "page" : undefined}
						onclick={() => {
							requestedPage = number;
						}}>{number}</button
					>{/each}<button
					type="button"
					class="control"
					disabled={page === 0 || page >= pageCount}
					onclick={() => {
						requestedPage = page + 1;
					}}>Next</button>
			</nav>
			<p role="status" class="text-muted text-xs">{pageItems.length} fixture samples · Page {page} of {pageCount}</p>
		</div>

		<div class="border-hairline min-w-0 space-y-3 rounded-2xl border bg-white p-4">
			<h3 class="font-semibold">Progress</h3>
			<p class="text-muted text-sm">Manual simulation only; not upload or background activity.</p>
			<label class="flex items-center gap-2 text-xs"><input type="checkbox" class="check" bind:checked={indeterminate} />Indeterminate specimen</label>
			<p id={`${id}-progress-label`} class="text-sm font-medium">{indeterminate ? "Simulated activity · total unknown" : `Simulated completion · ${progress}%`}</p>
			<div role="progressbar" aria-labelledby={`${id}-progress-label`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={indeterminate ? undefined : progress} class="bg-paper-pill h-2 overflow-hidden rounded-full">
				<div class={["bg-field h-full rounded-full", indeterminate && "w-1/3 motion-safe:animate-pulse"]} style:width={indeterminate ? "33%" : `${progress}%`}></div>
			</div>
			<label class="block text-xs">Fixture completion<input type="range" min="0" max="100" step="10" bind:value={progress} disabled={indeterminate} class="accent-field mt-2 block h-8 w-full disabled:opacity-50" /></label>
		</div>

		<div class="border-hairline min-w-0 space-y-3 rounded-2xl border bg-white p-4">
			<h3 class="font-semibold">Radio group</h3>
			<fieldset class="space-y-2">
				<legend class="text-muted mb-3 text-sm">Fixture density choice; it does not change the workspace.</legend
				>{#each [{ id: "comfortable", label: "Comfortable", detail: "More breathing room" }, { id: "compact", label: "Compact", detail: "A tighter specimen" }, { id: "unavailable", label: "Unavailable", detail: "Disabled state", disabled: true }] as option (option.id)}<label
						class="choice items-start has-disabled:opacity-50"
						><input type="radio" name={`${id}-density`} value={option.id} bind:group={radioValue} disabled={option.disabled} class="radio" /><span class="text-sm"><span class="block font-medium">{option.label}</span><span class="text-muted text-xs">{option.detail}</span></span></label
					>{/each}
			</fieldset>
			<p role="status" class="text-muted text-xs">Selected fixture: {radioValue}</p>
		</div>
	</div>
</div>

{#snippet suggestionList(kind: Picker)}
	{#if pickers[kind].open}
		<div class="surface surface-floating menu absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto">
			<div id={`${id}-${kind}-list`} role="listbox" aria-label={kind === "combo" ? "Sample colors" : "Available sample colors"}>
				{#each options(kind) as choice, index (choice.id)}
					<button
						id={`${id}-${kind}-${choice.id}`}
						type="button"
						role="option"
						tabindex="-1"
						aria-selected={kind === "combo" ? selectedChoice === choice.id : tagIds.includes(choice.id)}
						data-active={index === pickers[kind].active}
						class="menu-item"
						onpointerdown={(event) => {
							event.preventDefault();
						}}
						onclick={() => choose(kind, choice)}>{choice.label}</button>
				{/each}
			</div>
			{#if options(kind).length === 0}<p role="status" class="text-muted p-3 text-sm">{kind === "tags" && tagIds.length === choices.length ? "All sample colors selected." : "No matching sample colors."}</p>{/if}
		</div>
	{/if}
{/snippet}

<script lang="ts">
	let {
		placeholder,
		pinned = true,
		onpost,
	}: {
		placeholder: string;
		/** Pinned under a scroller as the record's bottom bar; otherwise it follows the feed. */
		pinned?: boolean;
		/** Posts the note and shows it at once; resolves false when posting failed. */
		onpost: (body: string) => Promise<boolean>;
	} = $props();

	let text = $state("");
	let posting = $state(0);

	// The box clears as the note appears in Activity; if posting fails, the text comes back unless something new was typed.
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const body = text.trim();
		if (!body) return;
		text = "";
		posting += 1;
		const posted = await onpost(body);
		posting -= 1;
		if (!posted && !text.trim()) text = body;
	}
</script>

<form aria-label="Add a note" class={pinned ? "border-hairline shrink-0 border-t px-(--gutter) py-3" : "mt-4"} data-pinned-bar={pinned || undefined} aria-busy={posting > 0} onsubmit={submit}>
	<div class="field-group items-end">
		<textarea
			class="field-bare field-sizing-content max-h-40 resize-none py-2 leading-[1.4]"
			aria-label="Note"
			rows="1"
			{placeholder}
			maxlength="20000"
			bind:value={text}
			onkeydown={(event) => {
				if (!event.isComposing && event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
			}}></textarea>
		<button class="control" data-variant="primary" data-size="sm" disabled={!text.trim()}>Post</button>
	</div>
</form>

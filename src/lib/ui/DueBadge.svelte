<script lang="ts">
	import type { DueState } from "./presentation.js";
	let { label, state }: { label: string; state: DueState } = $props();
</script>

<span
	data-due-state={state}
	class="bg-paper/60 text-muted data-[due-state=overdue]:bg-urgent-soft data-[due-state=overdue]:text-urgent data-[due-state=today]:bg-pending-soft data-[due-state=today]:text-pending data-[due-state=upcoming]:bg-info-soft data-[due-state=upcoming]:text-info text-2xs inline-flex shrink-0 items-center rounded-md px-2 py-0.5 leading-4"
	>{label}</span>

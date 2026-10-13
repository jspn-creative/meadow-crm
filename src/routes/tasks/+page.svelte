<script lang="ts">
	import TaskList from "#lib/tasks/TaskList.svelte";
	import { tasks } from "#lib/shell/fixtures.js";
</script>

<svelte:head><title>Tasks · Meadow Lane</title></svelte:head>

<div class="surface-content">
	<div class="max-w-2xl"><TaskList items={tasks} /></div>
</div>

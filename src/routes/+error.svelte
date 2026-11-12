<script lang="ts">
	let { error } = $props();
	let status = $derived(error?.status ?? 500);
</script>

<svelte:head><title>Unable to open view · Meadow Lane</title></svelte:head>

<section class="surface-content mx-auto max-w-xl" aria-labelledby="error-heading">
	<p class="text-muted text-sm">{status}</p>
	<h2 id="error-heading" class="font-display mt-2 text-3xl tracking-tight">{status === 404 ? "That view isn’t here." : "This view couldn’t open."}</h2>
	<p class="text-muted mt-3">{status === 404 ? "The link may be out of date. You can return to the Dashboard." : "Please try again. If this keeps happening, return to login."}</p>
	<div class="mt-6 flex flex-wrap gap-3">
		<button type="button" class="control" data-variant="primary" onclick={() => window.location.reload()}>Try again</button>
		<a href="/" class="control">Dashboard</a>
		<a href="/login" class="control" data-sveltekit-reload>Login</a>
	</div>
</section>

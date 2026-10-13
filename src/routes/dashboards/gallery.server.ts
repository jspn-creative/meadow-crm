// Disabled gallery data loader, retained alongside Gallery.svelte for future reference. This is not a SvelteKit route file.
import { dashboards } from "#lib/dashboards.server";

export const load = () => ({ dashboards });

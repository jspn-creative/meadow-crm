import type { D1Database } from "@cloudflare/workers-types";

// See https://svelte.dev/docs/kit/types#app.d.ts for information about these interfaces.
declare global {
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
		}
	}
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

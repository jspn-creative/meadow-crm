import type { D1Database } from "@cloudflare/workers-types";
import type { DataService } from "#lib/server/data.js";

// See https://svelte.dev/docs/kit/types#app.d.ts for information about these interfaces.
declare global {
	namespace Cloudflare {
		interface Env {
			DB: D1Database;
			LOCAL_DEMO_USER?: "realtor" | "assistant";
		}
	}
	namespace App {
		// interface Error {}
		interface Locals {
			data: DataService | null;
			requestOrigin: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

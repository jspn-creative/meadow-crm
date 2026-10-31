import type { WebsiteEnv } from "../alchemy.run.ts";
import type { DataService } from "#lib/server/data.js";
import type { SupportState } from "#lib/server/support.js";

// See https://svelte.dev/docs/kit/types#app.d.ts for information about these interfaces.
declare global {
	namespace Cloudflare {
		interface Env extends WebsiteEnv {}
	}
	namespace App {
		// interface Error {}
		interface Locals {
			data: DataService | null;
			requestOrigin: string;
			support: SupportState | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: Cloudflare.Env;
			context?: unknown;
			caches?: unknown;
		}
	}
}

export {};

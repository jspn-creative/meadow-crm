/// <reference types="@cloudflare/workers-types" />

import type { WebsiteEnv } from "../alchemy.run.ts";
import { createAuth } from "../src/lib/server/auth.ts";

// CLI schema generation only: no environment files, credentials, database connection, or migration runner.
export const auth = createAuth(
	{
		DB: {} as WebsiteEnv["DB"],
		BETTER_AUTH_SECRET: "schema-generation-only-not-an-application-secret",
		BETTER_AUTH_URL: "http://localhost:1337",
		LOCAL_IDENTITY_STUB: "false",
		LOCAL_DEMO_USER: "realtor",
	},
	true,
)!;

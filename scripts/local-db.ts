import { getPlatformProxy } from "wrangler";
import type { D1Database } from "@cloudflare/workers-types";
import { migrate } from "../src/lib/server/db/migrate.ts";
import { seedDefaults } from "../src/lib/server/db/seed.ts";
import { readMigrations } from "./migrations.ts";
import { resetFictional, seedFictional } from "./fictional-seed.ts";

const [command, ...args] = process.argv.slice(2).filter((arg) => arg !== "--");
const help =
	"Local D1 only: vp run db:migrate | vp run db:seed | vp run db:seed-fictional -- --today=YYYY-MM-DD | vp run db:reset-fictional -- --confirm-fictional-reset. Defaults never overwrite edited templates; reset deletes only fictional records and refuses protected links. Copy .dev.vars.example to .dev.vars, configure Better Auth, and create accounts with vp run auth:create. The optional LOCAL_IDENTITY_STUB=true plus LOCAL_DEMO_USER=realtor or assistant bypass works only in loopback development; production ignores it. MEADOW_LOCAL_STATE_DIR optionally isolates local runtime/test storage. No command accesses Cloudflare accounts or remote D1.";
if (!command || command === "help") {
	console.log(help);
} else {
	if (!["migrate", "seed", "seed-fictional", "reset-fictional"].includes(command))
		throw new Error(help);
	if (command === "reset-fictional" && !args.includes("--confirm-fictional-reset"))
		throw new Error("Reset requires --confirm-fictional-reset. " + help);
	if (args.some((arg) => !arg.startsWith("--today=") && arg !== "--confirm-fictional-reset"))
		throw new Error(help);
	const proxy = await getPlatformProxy<{ DB: D1Database }>({
		configPath: "wrangler.jsonc",
		persist: { path: process.env.MEADOW_LOCAL_STATE_DIR ?? ".wrangler/state/v3" },
	});
	try {
		if (command === "migrate") await migrate(proxy.env.DB, await readMigrations());
		if (command === "seed") await seedDefaults(proxy.env.DB);
		if (command === "seed-fictional")
			await seedFictional(
				proxy.env.DB,
				args.find((arg) => arg.startsWith("--today="))?.slice(8) ??
					new Date().toISOString().slice(0, 10),
			);
		if (command === "reset-fictional") await resetFictional(proxy.env.DB);
		console.log(`Local D1 ${command} complete.`);
	} finally {
		await proxy.dispose();
	}
}

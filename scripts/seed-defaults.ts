import { seedDefaults } from "../src/lib/server/db/seed.ts";
import { remoteD1Database } from "./remote-d1.ts";

const args = process.argv.slice(2).filter((arg: string) => arg !== "--");
if (args.length !== 1 || args[0] !== "--remote")
	throw new Error("Usage: vp run db:seed-remote (remote D1 only).");

await seedDefaults(remoteD1Database());
console.log("Remote default seed complete.");

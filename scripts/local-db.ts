import { localD1Database } from "./local-d1.ts";
import { seedDefaults } from "../src/lib/server/db/seed.ts";
import { resetFictional, seedFictional } from "./fictional-seed.ts";

const [command, ...args] = process.argv.slice(2).filter((arg: string) => arg !== "--");
const help =
	"Local Alchemy D1 only: vp run db:seed | vp run db:seed-fictional -- --today=YYYY-MM-DD | vp run db:reset-fictional -- --confirm-fictional-reset. Start vp run dev first; Alchemy exclusively owns migrations.";
if (!command || command === "help") console.log(help);
else {
	if (!["seed", "seed-fictional", "reset-fictional"].includes(command)) throw new Error(help);
	if (
		args.some(
			(arg: string) => !/^--today=\d{4}-\d{2}-\d{2}$/.test(arg) && arg !== "--confirm-fictional-reset",
		)
	)
		throw new Error(help);
	if (command === "reset-fictional" && !args.includes("--confirm-fictional-reset"))
		throw new Error(help);
	const proxy = await localD1Database();
	try {
		if (command === "seed") await seedDefaults(proxy.env.DB);
		if (command === "seed-fictional")
			await seedFictional(
				proxy.env.DB,
				args.find((arg: string) => arg.startsWith("--today="))?.slice(8) ??
					new Date().toISOString().slice(0, 10),
			);
		if (command === "reset-fictional") await resetFictional(proxy.env.DB);
		console.log(`Local D1 ${command} complete.`);
	} finally {
		await proxy.dispose();
	}
}

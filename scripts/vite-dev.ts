import { spawn } from "node:child_process";
import type { Plugin } from "vite-plus";

/** Keep the Vite+ shortcut on Alchemy's native live entrypoint; Alchemy's own Vite server must not launch it again. */
export function liveDevShortcut(): Plugin {
	const isDevCLI =
		/[/\\]vite[/\\].*[/\\](?:cli|vite)\.js$/.test(process.argv[1] ?? "") &&
		process.argv.slice(2).includes("dev");
	return {
		name: "meadow:live-dev-shortcut",
		apply: (_config, environment) =>
			isDevCLI && environment.command === "serve" && !environment.isPreview && !process.env.VITEST,
		async configResolved(config) {
			if (config.plugins.some((plugin) => plugin.name === "distilled-sveltekit-config")) return;
			console.warn(
				"vp dev starts LIVE PRODUCTION development. All app writes affect production. Use vp run dev:local for an isolated local database.",
			);
			const child = spawn("vp", ["run", "dev:live"], { cwd: config.root, stdio: "inherit" });
			const interrupt = () => child.kill("SIGINT");
			const terminate = () => child.kill("SIGTERM");
			process.on("SIGINT", interrupt);
			process.on("SIGTERM", terminate);
			const code = await new Promise<number>((resolve) => {
				child.on("error", () => {
					console.error("Unable to start live development through vp run dev:live.");
					resolve(1);
				});
				child.on("exit", (code, signal) => resolve(code ?? (signal === "SIGINT" ? 130 : 1)));
			});
			process.off("SIGINT", interrupt);
			process.off("SIGTERM", terminate);
			// The child owns the actual Vite server, bindings, and HMR; never start a second bare server after it exits.
			process.exit(code);
		},
	};
}

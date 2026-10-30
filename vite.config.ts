import { execFile } from "node:child_process";
import { promisify } from "node:util";
import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-cloudflare";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
	plugins: lazyPlugins(() => [
		{
			name: "meadow-local-d1-migrations",
			async configureServer(server) {
				if (process.env.VITEST || server.config.mode === "test") return;
				// Prepare the same local D1 storage as the adapter before serving any requests; never run during builds or preview.
				const { stdout, stderr } = await promisify(execFile)("vp", ["run", "db:migrate"], {
					cwd: import.meta.dirname,
					env: process.env,
				});
				if (stdout) console.log(stdout.trimEnd());
				if (stderr) console.error(stderr.trimEnd());
			},
		},
		tailwindcss(),
		enhancedImages(),
		sveltekit({
			inspector: { toggleKeyCombo: "alt-s" },
			compilerOptions: {
				runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
				experimental: { async: true },
			},
			adapter: adapter({
				config: "wrangler.jsonc",
				platformProxy: {
					persist: { path: process.env.MEADOW_LOCAL_STATE_DIR ?? ".wrangler/state/v3" },
				},
			}),
			experimental: {
				remoteFunctions: true,
				compileModule: { exclude: ["**/.svelte-kit/**"] },
			},
		}),
	]),
	test: {
		globals: false,
		include: ["src/**/*.test.ts"],
	},
	fmt: {
		svelte: true,
		ignorePatterns: ["**/*.md"],
		overrides: [{ files: ["static/**/*.html", "src/**/*.svelte"], options: { printWidth: 320 } }],
		sortTailwindcss: true,
		bracketSameLine: true,
		tabWidth: 1,
		trailingComma: "all",
		useTabs: true,
	},
	lint: {
		jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
		rules: { "vite-plus/prefer-vite-plus-imports": "error" },
		options: { typeAware: true, typeCheck: true },
		ignorePatterns: ["dist/**"],
	},
	check: {
		fmt: true,
		lint: true,
	},
	staged: {
		"*.{js,ts,svelte,css,json,md,html}": "vp check --fix",
	},
});

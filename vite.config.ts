import tailwindcss from "@tailwindcss/vite";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, lazyPlugins } from "vite-plus";
import { liveDevShortcut } from "./scripts/vite-dev.ts";

export default defineConfig({
	plugins: lazyPlugins(() => [
		liveDevShortcut(),
		tailwindcss(),
		enhancedImages(),
		sveltekit({
			inspector: { toggleKeyCombo: "alt-s" },
			compilerOptions: {
				runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
				experimental: { async: true },
			},
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

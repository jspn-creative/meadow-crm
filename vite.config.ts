import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-auto";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
	plugins: lazyPlugins(() => [
		tailwindcss(),
		enhancedImages(),
		sveltekit({
			inspector: { showToggleButton: "always", toggleKeyCombo: "alt-s" },
			compilerOptions: {
				runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
				experimental: { async: true },
			},
			adapter: adapter(),
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

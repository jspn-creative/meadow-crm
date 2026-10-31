import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	globalSetup: "./scripts/playwright-setup.ts",
	fullyParallel: true,
	use: { baseURL: "http://localhost:1337", trace: "retain-on-failure" },
	projects: [
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
		},
		{
			name: "phone",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 375, height: 812 },
				isMobile: true,
				hasTouch: true,
			},
		},
	],
	webServer: {
		command: "vp exec -- alchemy dev --stage dev --env-file .dev.vars",
		env: { LOCAL_IDENTITY_STUB: "true" },
		url: "http://localhost:1337",
		reuseExistingServer: false,
	},
});

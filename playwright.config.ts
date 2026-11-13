import { defineConfig, devices } from "@playwright/test";

const url = `http://localhost:${process.env.MEADOW_DEV_PORT ?? 1337}`;

export default defineConfig({
	testDir: "./tests",
	globalSetup: "./scripts/playwright-setup.ts",
	fullyParallel: true,
	use: { baseURL: url, trace: "retain-on-failure" },
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
		url,
		reuseExistingServer: false,
	},
});

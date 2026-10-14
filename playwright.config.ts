import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	use: { baseURL: "http://127.0.0.1:5180", trace: "retain-on-failure" },
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
		command:
			"vp run db:migrate && vp run db:seed && vp run db:seed-fictional -- --today=2026-10-13 && vp dev --host 127.0.0.1 --port 5180 --strictPort",
		env: { MEADOW_LOCAL_STATE_DIR: ".wrangler/test-shell" },
		url: "http://127.0.0.1:5180",
		reuseExistingServer: false,
	},
});

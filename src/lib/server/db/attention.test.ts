import { expect, test } from "vite-plus/test";
import { businessDate, isOverdue } from "../../data/attention.ts";

test("overdue uses the business calendar date, not device or UTC midnight", () => {
	const instant = new Date("2026-10-14T02:00:00Z");
	expect(businessDate("America/New_York", instant)).toBe("2026-10-13");
	expect(businessDate("Asia/Tokyo", instant)).toBe("2026-10-14");
	const today = businessDate("America/New_York", instant);
	expect(isOverdue("2026-10-12", null, today)).toBe(true);
	expect(isOverdue("2026-10-13", null, today)).toBe(false);
	expect(isOverdue("2026-10-14", null, today)).toBe(false);
	expect(isOverdue(null, null, today)).toBe(false);
	expect(isOverdue("2026-10-12", instant.toISOString(), today)).toBe(false);
	expect(businessDate("America/New_York", new Date("2026-10-14T04:00:00Z"))).toBe("2026-10-14");
	expect(businessDate("America/New_York", new Date("2026-03-08T07:00:00Z"))).toBe("2026-03-08");
});

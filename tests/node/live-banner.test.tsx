import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LIVE_BANNER_MARKER, LiveDataBanner } from "@/components/admin/live-banner";
import { isLiveData } from "@/lib/admin/access";

describe("LIVE DATA banner", () => {
	it("is pinned and styled inline, so it shows even without the stylesheet", () => {
		const html = renderToStaticMarkup(<LiveDataBanner />);
		expect(html).toContain(LIVE_BANNER_MARKER);
		expect(html).toContain('role="alert"');
		expect(html).toMatch(/style="[^"]*position:sticky/);
		expect(html).toMatch(/style="[^"]*background:#b42318/);
		expect(html).toMatch(/style="[^"]*color:#ffffff/);
		expect(html).toContain("LIVE DATA");
		expect(html).not.toMatch(/<button|onclick|dismiss/i);
	});

	it("is on whenever the live database is connected", () => {
		expect(isLiveData({ ADMIN_DATA: "live" })).toBe(true);
		expect(isLiveData({})).toBe(false);
		process.env.ADMIN_DATA = "live";
		expect(isLiveData()).toBe(true);
		delete process.env.ADMIN_DATA;
	});
});

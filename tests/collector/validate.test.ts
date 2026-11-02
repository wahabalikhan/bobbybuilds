import { describe, expect, it } from "vitest";
import { browserGroup, deviceGroup, isBot, osGroup } from "@/lib/collector/ua";
import { cleanDomain, cleanLanguage, cleanRef, cleanUtm, looksPersonal, screenGroup } from "@/lib/collector/validate";

const UAS = {
	macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
	winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
	winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
	iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	ipad: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	samsung: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
	androidTablet: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	opera: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0",
	chromebook: "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
	linuxFirefox: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
};

describe("user agent groups", () => {
	it.each([
		[UAS.macChrome, "desktop", "chrome", "macos"],
		[UAS.macSafari, "desktop", "safari", "macos"],
		[UAS.winEdge, "desktop", "edge", "windows"],
		[UAS.winFirefox, "desktop", "firefox", "windows"],
		[UAS.iphone, "mobile", "safari", "ios"],
		[UAS.ipad, "tablet", "safari", "ios"],
		[UAS.samsung, "mobile", "samsung", "android"],
		[UAS.androidTablet, "tablet", "chrome", "android"],
		[UAS.opera, "desktop", "opera", "windows"],
		[UAS.chromebook, "desktop", "chrome", "chromeos"],
		[UAS.linuxFirefox, "desktop", "firefox", "linux"],
	])("%s", (ua, device, browser, os) => {
		expect([deviceGroup(ua), browserGroup(ua), osGroup(ua)]).toEqual([device, browser, os]);
	});

	it("spots bots and empty user agents", () => {
		expect(isBot("Googlebot/2.1 (+http://www.google.com/bot.html)")).toBe(true);
		expect(isBot("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
		expect(isBot("curl/8.4.0")).toBe(true);
		expect(isBot("Mozilla/5.0 HeadlessChrome/130.0")).toBe(true);
		expect(isBot("")).toBe(true);
		expect(isBot(UAS.macChrome)).toBe(false);
	});
});

describe("cleaning", () => {
	it("keeps good refs and drops bad ones", () => {
		expect(cleanRef("linkedin-post-3")).toBe("linkedin-post-3");
		expect(cleanRef("a".repeat(41))).toBeNull();
		expect(cleanRef("linkedin_post")).toBeNull();
		expect(cleanRef(42)).toBeNull();
	});

	it("tidies UTM values", () => {
		expect(cleanUtm("LinkedIn")).toBe("linkedin");
		expect(cleanUtm("Launch Week!")).toBe("launch-week");
		expect(cleanUtm("x".repeat(51))).toBeNull();
		expect(cleanUtm("???")).toBeNull();
	});

	it("keeps bare domains only", () => {
		expect(cleanDomain("WWW.LinkedIn.com")).toBe("linkedin.com");
		expect(cleanDomain("linkedin.com/feed")).toBeNull();
		expect(cleanDomain("https://linkedin.com")).toBeNull();
	});

	it("keeps the primary language only", () => {
		expect(cleanLanguage("en-GB")).toBe("en");
		expect(cleanLanguage("fil")).toBe("fil");
		expect(cleanLanguage("e")).toBeNull();
	});

	it("groups screen widths", () => {
		expect([screenGroup(390), screenGroup(800), screenGroup(1280), screenGroup(1920), screenGroup(null)]).toEqual([
			"small", "medium", "large", "xlarge", "unknown",
		]);
	});

	it("spots emails and phone numbers but not dates or counts", () => {
		expect(looksPersonal("jo@example.com")).toBe(true);
		expect(looksPersonal("+44 7700 900123")).toBe(true);
		expect(looksPersonal("07700900123")).toBe(true);
		expect(looksPersonal("2026-11-02")).toBe(false);
		expect(looksPersonal("hiring")).toBe(false);
		expect(looksPersonal("12345")).toBe(false);
	});
});

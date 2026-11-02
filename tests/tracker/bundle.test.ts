import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { beforeAll, describe, expect, it } from "vitest";

// Runs the real built public/t.js (with web-vitals bundled) in a simulated browser.
let bundle = "";
beforeAll(() => {
	execFileSync("node", ["scripts/build-tracker.mjs"], { stdio: "ignore" });
	bundle = readFileSync("public/t.js", "utf8");
});

async function runBundle({ gpc = false, key = "pk_bundle" }: { gpc?: boolean; key?: string | null } = {}) {
	const win = new Window({ url: "https://wahabalikhan.com/work?utm_source=newsletter&secret=1" });
	Object.defineProperty(win.navigator, "webdriver", { value: false, configurable: true });
	if (gpc) Object.defineProperty(win.navigator, "globalPrivacyControl", { value: true, configurable: true });

	const requests: { url: string; init: RequestInit }[] = [];
	(win as unknown as { fetch: unknown }).fetch = async (url: string, init: RequestInit) => {
		requests.push({ url, init });
		return new win.Response('{"v":7}', { status: 200, headers: { "Content-Type": "application/json" } });
	};

	const script = win.document.createElement("script");
	script.setAttribute("src", "https://bobby.example/t.js");
	if (key) script.dataset.key = key;
	win.document.head.appendChild(script);
	Object.defineProperty(win.document, "currentScript", { get: () => script, configurable: true });

	win.eval(bundle);
	await new Promise((resolve) => setTimeout(resolve, 10));
	const bobby = (win as unknown as { bobby: { track: (name: string, props?: object) => void } }).bobby;
	return { win, requests, bobby };
}

describe("built t.js", () => {
	it("is small", () => {
		expect(bundle.length).toBeLessThan(16_000);
	});

	it("sends a page view to the collector it was loaded from, as text/plain without cookies", async () => {
		const { requests, win } = await runBundle();
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe("https://bobby.example/v1/pv");
		expect(requests[0].init).toMatchObject({ method: "POST", credentials: "omit", keepalive: true, headers: { "Content-Type": "text/plain" } });
		const body = JSON.parse(String(requests[0].init.body));
		expect(body).toMatchObject({ type: "view", key: "pk_bundle", path: "/work", utm_source: "newsletter" });
		expect(String(requests[0].init.body)).not.toContain("secret");
		await win.happyDOM.close();
	});

	it("sends bobby.track events", async () => {
		const { requests, bobby, win } = await runBundle();
		bobby.track("case_study_read", { study: "hiring" });
		expect(requests.at(-1)?.url).toBe("https://bobby.example/v1/events");
		expect(JSON.parse(String(requests.at(-1)?.init.body))).toEqual({ key: "pk_bundle", name: "case_study_read", path: "/work", props: { study: "hiring" } });
		await win.happyDOM.close();
	});

	it("sends nothing with Global Privacy Control on, but bobby.track is still safe to call", async () => {
		const { requests, bobby, win } = await runBundle({ gpc: true });
		bobby.track("case_study_read");
		expect(requests).toEqual([]);
		await win.happyDOM.close();
	});

	it("does nothing without a data-key", async () => {
		const { requests, win } = await runBundle({ key: null });
		expect(requests).toEqual([]);
		await win.happyDOM.close();
	});
});

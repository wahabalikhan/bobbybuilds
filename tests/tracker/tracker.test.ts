import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createTracker, downloadInfo, install, privacySignalOn, type Send, shouldRun } from "@/tracker/core";

type Sent = { path: string; body: Record<string, unknown> };

const windows: Window[] = [];
afterEach(async () => {
	for (const win of windows.splice(0)) await win.happyDOM.close();
});

function setup(url = "https://wahabalikhan.com/case-studies/hiring?ref=linkedin-post-3&utm_source=LinkedIn&email=jo@example.com", html = "") {
	const win = new Window({ url, width: 1280, height: 800 });
	windows.push(win);
	// happy-dom reports itself as automated; behave like a normal browser unless a test says otherwise.
	Object.defineProperty(win.navigator, "webdriver", { value: false, configurable: true });
	win.document.body.innerHTML = html;
	const sent: Sent[] = [];
	let nextId = 1;
	const send: Send = async (path, body) => {
		sent.push({ path, body });
		return path === "/v1/pv" && body.type === "view" ? { v: nextId++ } : null;
	};
	return { win, sent, send, w: win as unknown as globalThis.Window };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const events = (sent: Sent[]) => sent.filter((s) => s.path === "/v1/events").map((s) => [s.body.name, s.body.props]);

function setVisibility(win: Window, state: "visible" | "hidden") {
	Object.defineProperty(win.document, "visibilityState", { value: state, configurable: true });
	win.document.dispatchEvent(new win.Event("visibilitychange"));
}

function click(win: Window, href: string, init: Record<string, unknown> = {}) {
	const link = win.document.createElement("a");
	link.href = href;
	link.textContent = "link";
	win.document.body.appendChild(link);
	link.addEventListener("click", (event) => event.preventDefault()); // don't actually navigate
	link.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
}

describe("privacy signals", () => {
	it("sends nothing at all with Global Privacy Control on, and bobby.track still works as a no-op", async () => {
		const { win, w, sent, send } = setup();
		Object.defineProperty(win.navigator, "globalPrivacyControl", { value: true, configurable: true });
		expect(privacySignalOn(w)).toBe(true);
		expect(install({ win: w, key: "pk_test", send })).toBeNull();
		(w as unknown as { bobby: { track: (n: string) => void } }).bobby.track("case_study_read");
		await tick();
		expect(sent).toEqual([]);
	});

	it("sends nothing with Do Not Track on", async () => {
		const { win, w, sent, send } = setup();
		Object.defineProperty(win.navigator, "doNotTrack", { value: "1", configurable: true });
		expect(install({ win: w, key: "pk_test", send })).toBeNull();
		await tick();
		expect(sent).toEqual([]);
	});

	it("doesn't run in automated browsers or on file:// pages", () => {
		const { win, w } = setup();
		Object.defineProperty(win.navigator, "webdriver", { value: true, configurable: true });
		expect(shouldRun(w)).toBe(false);
		const local = setup("file:///Users/me/index.html");
		expect(shouldRun(local.w)).toBe(false);
	});

	it("runs normally otherwise", () => {
		expect(shouldRun(setup().w)).toBe(true);
	});
});

describe("page views", () => {
	it("sends the path, ref and UTM values only, never the rest of the query string", async () => {
		const { w, sent, send } = setup();
		install({ win: w, key: "pk_test", send })!.start();
		await tick();
		expect(sent[0]).toEqual({
			path: "/v1/pv",
			body: { type: "view", key: "pk_test", path: "/case-studies/hiring", ref: "linkedin-post-3", utm_source: "LinkedIn", width: 1280, language: expect.any(String) },
		});
		expect(JSON.stringify(sent)).not.toContain("jo@example.com");
	});

	it("sends only the referrer's domain, and nothing for internal referrers", async () => {
		const first = setup();
		Object.defineProperty(first.win.document, "referrer", { value: "https://www.linkedin.com/feed/update/123?trk=abc", configurable: true });
		createTracker({ key: "pk_test", win: first.w, send: first.send }).start();
		await tick();
		expect(first.sent[0].body.referrer).toBe("www.linkedin.com");

		const internal = setup();
		Object.defineProperty(internal.win.document, "referrer", { value: "https://wahabalikhan.com/", configurable: true });
		createTracker({ key: "pk_test", win: internal.w, send: internal.send }).start();
		await tick();
		expect(internal.sent[0].body.referrer).toBeUndefined();
	});

	it("records single-page-app navigation and closes the previous view", async () => {
		const { win, w, sent, send } = setup("https://wahabalikhan.com/");
		createTracker({ key: "pk_test", win: w, send }).start();
		await tick();
		win.history.pushState({}, "", "/about");
		await tick();
		win.history.replaceState({}, "", "/about?tab=2"); // same path: not a new view
		await tick();
		expect(sent.map((s) => [s.body.type, s.body.path ?? s.body.view])).toEqual([
			["view", "/"],
			["leave", 1],
			["view", "/about"],
		]);
		expect(sent[2].body.referrer).toBeUndefined();
	});
});

describe("leave beacon", () => {
	it("sends engaged time, scroll depth and Core Web Vitals when the page is hidden", async () => {
		let clock = 1_000;
		const { win, w, sent, send } = setup();
		Object.defineProperty(win.document, "visibilityState", { value: "visible", configurable: true });
		const tracker = createTracker({ key: "pk_test", win: w, send, now: () => clock });
		tracker.start();
		await tick();
		tracker.setVital("lcp_ms", 1834.6);
		tracker.setVital("cls", 0.10512);
		tracker.setVital("inp_ms", 96.2);
		clock += 42_000;
		setVisibility(win, "hidden");
		await tick();
		expect(sent.at(-1)).toEqual({
			path: "/v1/pv",
			body: { type: "leave", key: "pk_test", view: 1, engaged_ms: 42_000, scroll_pct: expect.any(Number), lcp_ms: 1835, cls: 0.105, inp_ms: 96 },
		});
	});

	it("takes Core Web Vitals from t-vitals.js through bobby._vital", async () => {
		const { win, w, sent, send } = setup();
		install({ win: w, key: "pk_test", send })!.start();
		await tick();
		const bobby = (w as unknown as { bobby: { _vital: (name: string, value: number) => void } }).bobby;
		bobby._vital("lcp_ms", 2100.4);
		bobby._vital("inp_ms", 180);
		setVisibility(win, "hidden");
		await tick();
		expect(sent.at(-1)?.body).toMatchObject({ type: "leave", lcp_ms: 2100, inp_ms: 180 });
	});

	it("doesn't count time while the tab is hidden", async () => {
		let clock = 0;
		const { win, w, sent, send } = setup();
		Object.defineProperty(win.document, "visibilityState", { value: "visible", configurable: true });
		createTracker({ key: "pk_test", win: w, send, now: () => clock }).start();
		await tick();
		clock = 10_000;
		setVisibility(win, "hidden");
		clock = 500_000; // away for a long time
		setVisibility(win, "visible");
		clock = 505_000;
		setVisibility(win, "hidden");
		await tick();
		expect(sent.at(-1)?.body.engaged_ms).toBe(15_000);
	});

	it("sends Core Web Vitals only for the first view of a page load", async () => {
		const { win, w, sent, send } = setup("https://wahabalikhan.com/");
		const tracker = createTracker({ key: "pk_test", win: w, send });
		tracker.start();
		await tick();
		tracker.setVital("lcp_ms", 1200);
		win.history.pushState({}, "", "/about");
		await tick();
		setVisibility(win, "hidden");
		await tick();
		const leaves = sent.filter((s) => s.body.type === "leave");
		expect(leaves[0].body.lcp_ms).toBe(1200);
		expect(leaves[1].body.view).toBe(2);
		expect(leaves[1].body.lcp_ms).toBeUndefined();
	});
});

describe("automatic events", () => {
	it("records outbound link clicks with the destination domain only", async () => {
		const { win, w, sent, send } = setup();
		createTracker({ key: "pk_test", win: w, send }).start();
		click(win, "https://www.github.com/wahabalikhan/bobbybuilds?tab=readme");
		await tick();
		expect(events(sent)).toEqual([["outbound_click", { domain: "github.com" }]]);
	});

	it("records middle-clicks on outbound links too", async () => {
		const { win, w, sent, send } = setup();
		createTracker({ key: "pk_test", win: w, send }).start();
		const link = win.document.createElement("a");
		link.href = "https://linkedin.com/in/wahab";
		win.document.body.appendChild(link);
		link.dispatchEvent(new win.MouseEvent("auxclick", { bubbles: true, button: 1 }));
		await tick();
		expect(events(sent)).toEqual([["outbound_click", { domain: "linkedin.com" }]]);
	});

	it("ignores internal links, mailto: and tel:", async () => {
		const { win, w, sent, send } = setup();
		createTracker({ key: "pk_test", win: w, send }).start();
		click(win, "/about");
		click(win, "https://wahabalikhan.com/contact");
		click(win, "mailto:hello@wahabalikhan.com");
		click(win, "tel:+447700900123");
		await tick();
		expect(events(sent)).toEqual([]);
	});

	it("records file downloads with the file name and type only", async () => {
		const { win, w, sent, send } = setup();
		createTracker({ key: "pk_test", win: w, send }).start();
		click(win, "/files/Wahab%20Ali%20Khan%20CV.pdf?v=3");
		click(win, "https://cdn.example.com/assets/case-study.zip");
		click(win, "/notes/brief.DOCX");
		await tick();
		expect(events(sent)).toEqual([
			["file_download", { file: "Wahab Ali Khan CV.pdf", type: "pdf" }],
			["file_download", { file: "case-study.zip", type: "zip" }],
			["file_download", { file: "brief.DOCX", type: "docx" }],
		]);
	});

	it("knows which links are downloads", () => {
		expect(downloadInfo(new URL("https://a.com/x/report.pdf"))).toEqual({ file: "report.pdf", type: "pdf" });
		expect(downloadInfo(new URL("https://a.com/x/photo.jpg"))).toBeNull();
		expect(downloadInfo(new URL("https://a.com/about"))).toBeNull();
		expect(downloadInfo(new URL("https://a.com/.pdf"))).toBeNull();
	});

	it("records 404 pages marked with data-bobby-not-found", async () => {
		const { w, sent, send } = setup("https://wahabalikhan.com/old-case-study", '<main data-bobby-not-found><h1>Page not found</h1></main>');
		createTracker({ key: "pk_test", win: w, send }).start();
		await tick();
		expect(sent.filter((s) => s.path === "/v1/events").map((s) => s.body)).toEqual([
			{ key: "pk_test", name: "not_found", path: "/old-case-study", props: {} },
		]);
	});

	it("doesn't send not_found on normal pages", async () => {
		const { w, sent, send } = setup("https://wahabalikhan.com/", "<main><h1>Hello</h1></main>");
		createTracker({ key: "pk_test", win: w, send }).start();
		await tick();
		expect(events(sent)).toEqual([]);
	});
});

describe("bobby.track", () => {
	it("sends custom events, 404s and form drop-off with the current path", async () => {
		const { w, sent, send } = setup("https://wahabalikhan.com/contact");
		install({ win: w, key: "pk_test", send })!.start();
		const bobby = (w as unknown as { bobby: { track: (name: string, props?: Record<string, unknown>) => void } }).bobby;
		bobby.track("form_started", { form: "contact" });
		bobby.track("form_submitted", { form: "contact" });
		bobby.track("not_found");
		bobby.track("contact_click");
		await tick();
		expect(sent.filter((s) => s.path === "/v1/events").map((s) => s.body)).toEqual([
			{ key: "pk_test", name: "form_started", path: "/contact", props: { form: "contact" } },
			{ key: "pk_test", name: "form_submitted", path: "/contact", props: { form: "contact" } },
			{ key: "pk_test", name: "not_found", path: "/contact", props: {} },
			{ key: "pk_test", name: "contact_click", path: "/contact", props: {} },
		]);
	});

	it("sends events queued before t.js loaded", async () => {
		const { w, sent, send } = setup();
		(w as unknown as { bobby: unknown }).bobby = { q: [["case_study_read", { study: "hiring" }]], track() {} };
		install({ win: w, key: "pk_test", send })!.start();
		await tick();
		expect(events(sent)).toEqual([["case_study_read", { study: "hiring" }]]);
	});
});

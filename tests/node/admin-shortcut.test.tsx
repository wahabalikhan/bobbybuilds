import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/public/footer";
import { createTapCounter, handleShortcut, isAdminShortcut, TAP_GAP_MS } from "@/lib/public/admin-shortcut";
import { readFileSync } from "node:fs";
import { adminHref, site } from "@/lib/site";

const window = new Window();
const document = window.document;

/** A keydown as the browser sends it; Option + A on a Mac types "å". */
type KeyInit = { code?: string; key?: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; repeat?: boolean; isComposing?: boolean };

function key(init: KeyInit & { target?: Element } = {}) {
	const { target = document.body, ...rest } = init;
	const event = new window.KeyboardEvent("keydown", { code: "KeyA", key: "å", altKey: true, bubbles: true, cancelable: true, ...rest });
	Object.defineProperty(event, "target", { value: target });
	return event as unknown as KeyboardEvent;
}

describe("Option/Alt + A", () => {
	it("opens admin for Option/Alt + A, whatever character it types", () => {
		expect(isAdminShortcut(key())).toBe(true);
		expect(isAdminShortcut(key({ key: "a" }))).toBe(true);
	});

	it("needs Option/Alt and the A key", () => {
		expect(isAdminShortcut(key({ altKey: false }))).toBe(false);
		expect(isAdminShortcut(key({ code: "KeyS", key: "ß" }))).toBe(false);
	});

	it.each([["ctrlKey"], ["metaKey"], ["shiftKey"]])("does nothing with %s also held", (modifier) => {
		expect(isAdminShortcut(key({ [modifier]: true }))).toBe(false);
	});

	it("ignores a held-down key repeating and input-method composition", () => {
		expect(isAdminShortcut(key({ repeat: true }))).toBe(false);
		expect(isAdminShortcut(key({ isComposing: true }))).toBe(false);
	});

	it.each([["input"], ["textarea"], ["select"]])("does nothing while typing in a %s", (tag) => {
		const field = document.createElement(tag);
		document.body.appendChild(field);
		expect(isAdminShortcut(key({ target: field as unknown as Element }))).toBe(false);
	});

	it("does nothing inside editable content, including its children", () => {
		const editor = document.createElement("div");
		editor.setAttribute("contenteditable", "true");
		const inner = document.createElement("span");
		editor.appendChild(inner);
		document.body.appendChild(editor);
		expect(isAdminShortcut(key({ target: editor as unknown as Element }))).toBe(false);
		expect(isAdminShortcut(key({ target: inner as unknown as Element }))).toBe(false);
		const notEditable = document.createElement("div");
		notEditable.setAttribute("contenteditable", "false");
		document.body.appendChild(notEditable);
		expect(isAdminShortcut(key({ target: notEditable as unknown as Element }))).toBe(true);
	});
});

describe("five quick taps", () => {
	const taps = (times: number[]) => {
		const counter = createTapCounter();
		return times.map((t) => counter.tap(t));
	};

	it("opens admin on the fifth quick tap", () => {
		expect(taps([0, 200, 400, 600, 800])).toEqual([false, false, false, false, true]);
	});

	it("doesn't open on four taps", () => {
		expect(taps([0, 200, 400, 600])).not.toContain(true);
	});

	it("starts again after a slow gap", () => {
		expect(taps([0, 200, 400, 400 + TAP_GAP_MS + 1, 1300, 1500, 1700])).toEqual([false, false, false, false, false, false, false]);
		expect(taps([0, 200, 400, 400 + TAP_GAP_MS + 1, 1300, 1500, 1700, 1900])).toContain(true);
	});

	it("starts counting again after opening", () => {
		expect(taps([0, 100, 200, 300, 400, 500, 600, 700, 800])).toEqual([false, false, false, false, true, false, false, false, false]);
	});
});

describe("no visible admin link", () => {
	it("the footer looks like plain text and never links to admin", () => {
		const html = renderToStaticMarkup(<SiteFooter year={2026} />);
		expect(html).toContain("© 2026 Wahab Ali Khan");
		expect(html).not.toContain(adminHref());
		expect(html).not.toMatch(/role="button"|cursor-pointer|tabindex/);
	});
});

describe("the reverse shortcut, admin → public site", () => {
	/** Runs the shared handler and reports where it went, if anywhere, and whether the key was stopped. */
	const press = (to: string, init: Parameters<typeof key>[0] = {}) => {
		const event = key(init);
		let went: string | null = null;
		handleShortcut(event, () => (went = to));
		return { went, prevented: event.defaultPrevented };
	};

	it("Option/Alt + A goes to the public site, and the å isn't typed", () => {
		expect(press(site.url)).toEqual({ went: "https://bobbybuilds.app", prevented: true });
	});

	it("does nothing with other modifiers, on repeat, while composing, or while typing", () => {
		const field = document.createElement("textarea");
		document.body.appendChild(field);
		for (const init of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { repeat: true }, { isComposing: true }, { altKey: false }, { target: field as unknown as Element }]) {
			expect(press(site.url, init), JSON.stringify(Object.keys(init))).toEqual({ went: null, prevented: false });
		}
	});

	it("is on every admin page (the admin layout), with a visible View site link that names it", () => {
		const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
		expect(layout).toContain("<AdminKeyboardShortcut to={site.url} />");
		// The visible version of the shortcut (batch 1 of the admin changes): the public site, in the top bar.
		expect(layout).toMatch(/href=\{site\.url\}[^>]*aria-keyshortcuts="Alt\+A"/);
		expect(layout).toContain("View site");
	});
});

/**
 * The hidden ways between the public site and the admin dashboard (no visible link anywhere):
 * - Option + A on a Mac, Alt + A on Windows and Linux: public site → admin, and admin → public site;
 * - five quick taps on the footer's copyright line (phones): public site → admin.
 * They only navigate. Cloudflare Access and the JWT check in middleware stay the real protection.
 */

type ShortcutEvent = Pick<KeyboardEvent, "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "repeat" | "isComposing"> & { target: EventTarget | null };

/** True when someone is typing: a form field or anything editable has the key press. */
function isTyping(target: EventTarget | null): boolean {
	if (!target || typeof (target as Element).tagName !== "string") return false;
	const element = target as HTMLElement;
	return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) || element.isContentEditable === true || element.closest?.("[contenteditable]:not([contenteditable='false'])") != null;
}

/**
 * Option/Alt + A and nothing else. Uses event.code (the physical key), because Option + A types
 * "å" on a Mac, so event.key isn't "a".
 */
export function isAdminShortcut(event: ShortcutEvent): boolean {
	return (
		event.code === "KeyA" &&
		event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.shiftKey &&
		!event.repeat &&
		!event.isComposing &&
		!isTyping(event.target)
	);
}

/**
 * The keydown handler for both directions: on Option/Alt + A (by the rules above), stops the key
 * doing anything else and calls `go` (which navigates). Returns whether it did.
 */
export function handleShortcut(event: ShortcutEvent & Pick<KeyboardEvent, "preventDefault">, go: () => void): boolean {
	if (!isAdminShortcut(event)) return false;
	event.preventDefault();
	go();
	return true;
}

export const TAPS_NEEDED = 5;
/** The longest gap between two taps that still counts as "quick". */
export const TAP_GAP_MS = 600;

/** Counts taps; `tap(now)` returns true on the fifth quick tap in a row, then starts again. */
export function createTapCounter(needed = TAPS_NEEDED, gapMs = TAP_GAP_MS) {
	let count = 0;
	let last = -Infinity;
	return {
		tap(now: number): boolean {
			count = now - last <= gapMs ? count + 1 : 1;
			last = now;
			if (count < needed) return false;
			count = 0;
			last = -Infinity;
			return true;
		},
	};
}

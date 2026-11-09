"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToneIcon, type Tone } from "./message";

/**
 * Toasts, after RealTechJobs: one `<Toaster />` (in the admin layout) draws every toast, raised with
 * `showToast(tone, text)` from anywhere in the admin. One at a time (a new one replaces the old);
 * bottom centre, 24px up, 540px wide (phones: full width less 24px each side), 50px tall, the
 * tone's tint, icon and text with a darker edge and a clear shadow, and ✕ to close. 4 seconds,
 * paused while hovered or focused. Read out through a polite live region (assertive for errors).
 */
const EVENT = "bobby:toast";

type Toast = { id: number; tone: Tone; text: string };

export function showToast(tone: Tone, text: string) {
	window.dispatchEvent(new CustomEvent<Omit<Toast, "id">>(EVENT, { detail: { tone, text } }));
}

const LOOK: Record<Tone, string> = {
	success: "border-success-edge bg-success-bg text-success",
	info: "border-info-edge bg-info-bg text-info",
	warning: "border-notice-edge bg-notice-bg text-notice",
	error: "border-danger-edge bg-danger-bg text-danger",
};

const SHOWN_MS = 4000;
const OUT_MS = 150;

export function Toaster() {
	const [toast, setToast] = useState<Toast | null>(null);
	const [leaving, setLeaving] = useState(false);
	const [spoken, setSpoken] = useState<Toast | null>(null);
	// Two timers: how long it's shown, and its fade out. Kept apart, so arming one never cancels the other.
	const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const outTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const paused = useRef(false);
	const current = useRef<Toast | null>(null);
	const isLeaving = useRef(false);
	const next = useRef<Toast | null>(null);

	const dismiss = useCallback(() => {
		clearTimeout(showTimer.current);
		if (isLeaving.current) return;
		isLeaving.current = true;
		setLeaving(true);
		outTimer.current = setTimeout(() => {
			isLeaving.current = false;
			setLeaving(false);
			current.current = next.current;
			setToast(next.current);
			next.current = null;
		}, OUT_MS);
	}, []);

	const arm = useCallback(() => {
		clearTimeout(showTimer.current);
		if (!paused.current) showTimer.current = setTimeout(dismiss, SHOWN_MS);
	}, [dismiss]);

	useEffect(() => {
		let id = 0;
		const onToast = (event: Event) => {
			const detail = (event as CustomEvent<Omit<Toast, "id">>).detail;
			const incoming = { id: (id += 1), ...detail };
			setSpoken(incoming);
			// One at a time: the old one fades out first, then the new one comes in.
			if (current.current) {
				next.current = incoming;
				dismiss();
			} else {
				current.current = incoming;
				setToast(incoming);
			}
		};
		window.addEventListener(EVENT, onToast);
		return () => {
			window.removeEventListener(EVENT, onToast);
			clearTimeout(showTimer.current);
			clearTimeout(outTimer.current);
		};
	}, [dismiss]);

	// Each new toast is shown for 4 seconds (not while hovered or focused).
	useEffect(() => {
		if (toast && !leaving) arm();
		return () => clearTimeout(showTimer.current);
	}, [toast, leaving, arm]);

	const hold = (on: boolean) => {
		paused.current = on;
		if (on) clearTimeout(showTimer.current);
		else if (current.current && !isLeaving.current) arm();
	};

	return (
		<>
			<div className="sr-only" aria-live={spoken?.tone === "error" ? "assertive" : "polite"} role={spoken?.tone === "error" ? "alert" : "status"}>
				{spoken?.text}
			</div>
			{toast && (
				<div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6" aria-hidden>
					<div
						key={toast.id}
						data-toast={toast.tone}
						data-leaving={leaving || undefined}
						onMouseEnter={() => hold(true)}
						onMouseLeave={() => hold(false)}
						onFocus={() => hold(true)}
						onBlur={() => hold(false)}
						className={`toast pointer-events-auto flex w-full max-w-[540px] items-center gap-2.5 rounded-xl border text-sm shadow-[0_10px_30px_rgba(0,0,0,0.18)] ${LOOK[toast.tone]}`}
						style={{ height: 50, paddingLeft: 16, paddingRight: 8 }}
					>
						<ToneIcon tone={toast.tone} />
						<p className="line-clamp-2 min-w-0 flex-1 font-medium">{toast.text}</p>
						<button type="button" tabIndex={-1} onClick={dismiss} aria-label="Close" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-80 hover:opacity-100">
							<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
								<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
							</svg>
						</button>
					</div>
				</div>
			)}
		</>
	);
}

/**
 * A toast for a message that arrives in the page's address after a redirect ("?created=1"), shown
 * once on arrival; the parameter is then taken out of the address, so a reload doesn't repeat it.
 */
export function ToastOnLoad({ tone, text, param }: { tone: Tone; text: string; param: string }) {
	useEffect(() => {
		showToast(tone, text);
		const url = new URL(window.location.href);
		url.searchParams.delete(param);
		history.replaceState(history.state, "", url.pathname + url.search + url.hash);
	}, [tone, text, param]);
	return null;
}

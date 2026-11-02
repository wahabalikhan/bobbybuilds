/**
 * Bobby Builds tracker. Built into public/t.js by scripts/build-tracker.mjs.
 *
 * No cookies, no localStorage, no fingerprinting. Sends nothing at all when Global Privacy
 * Control or Do Not Track is on, or in automated browsers. Sends as little as it can:
 * the path (never the query string), ref and utm_* only, the referrer's domain only,
 * the viewport width and the browser language.
 *
 * Automatic events: outbound_click { domain }, file_download { file, type },
 * not_found (pages marked with data-bobby-not-found). Everything else via bobby.track().
 */

export type SendPath = "/v1/pv" | "/v1/events";
export type Send = (path: SendPath, body: Record<string, unknown>) => Promise<unknown>;
export type Props = Record<string, string | number | boolean>;
export type VitalName = "lcp_ms" | "cls" | "inp_ms";

/** Keep in sync with DOWNLOAD_TYPES in src/lib/collector/validate.ts. */
export const DOWNLOAD_TYPES = [
	"pdf", "zip", "docx", "doc", "xlsx", "xls", "csv", "pptx", "ppt", "key", "pages", "numbers",
	"txt", "rtf", "epub", "dmg", "exe", "msi", "pkg", "apk", "mp3", "mp4", "mov", "fig", "sketch",
];

type BobbyGlobal = { track: (name: string, props?: Props) => void; q?: IArguments[] | unknown[][] };
type TrackerWindow = Window & { bobby?: BobbyGlobal; doNotTrack?: string };
type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };

export function privacySignalOn(win: Window): boolean {
	const nav = win.navigator as PrivacyNavigator;
	return (
		nav.globalPrivacyControl === true ||
		nav.doNotTrack === "1" ||
		nav.doNotTrack === "yes" ||
		nav.msDoNotTrack === "1" ||
		(win as TrackerWindow).doNotTrack === "1"
	);
}

export function shouldRun(win: Window): boolean {
	return !privacySignalOn(win) && !win.navigator.webdriver && /^https?:$/.test(win.location.protocol);
}

/** File name and type for links to downloadable files, or null. */
export function downloadInfo(url: URL): { file: string; type: string } | null {
	let name = url.pathname.split("/").pop() ?? "";
	try {
		name = decodeURIComponent(name);
	} catch {
		// keep the raw name
	}
	const dot = name.lastIndexOf(".");
	const type = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
	if (!DOWNLOAD_TYPES.includes(type)) return null;
	return { file: name.slice(0, 100), type };
}

export function createTracker({ key, win, send, now = () => Date.now() }: { key: string; win: Window; send: Send; now?: () => number }) {
	const doc = win.document;
	const vitals: Partial<Record<VitalName, number>> = {};

	let viewId: number | null = null;
	let viewPath: string | null = null;
	let isFirstView = true;
	let sendVitals = false;
	let engagedMs = 0;
	let visibleSince: number | null = null;
	let maxScroll = 0;

	const path = () => (win.location.pathname || "/").slice(0, 200);
	const engagedNow = () => engagedMs + (visibleSince === null ? 0 : now() - visibleSince);

	function scrollPct(): number {
		const root = doc.documentElement;
		const height = Math.max(root.scrollHeight, doc.body?.scrollHeight ?? 0);
		if (height <= 0) return 100;
		return Math.max(0, Math.min(100, Math.round(((win.scrollY + win.innerHeight) / height) * 100)));
	}

	function referrerDomain(): string | undefined {
		try {
			const host = new URL(doc.referrer).hostname;
			return host && host !== win.location.hostname ? host : undefined;
		} catch {
			return undefined;
		}
	}

	function track(name: string, props: Props = {}): void {
		void send("/v1/events", { key, name, path: path(), props });
	}

	/** Engaged time, scroll depth and (first view of a page load only) Core Web Vitals. */
	function leave(): void {
		if (viewId === null) return;
		void send("/v1/pv", {
			type: "leave",
			key,
			view: viewId,
			engaged_ms: Math.round(engagedNow()),
			scroll_pct: maxScroll,
			...(sendVitals ? vitals : {}),
		});
	}

	async function view(): Promise<void> {
		leave(); // the previous view, when a single-page app navigates

		const current = path();
		const params = new URLSearchParams(win.location.search);
		const body: Record<string, unknown> = {
			type: "view",
			key,
			path: current,
			referrer: isFirstView ? referrerDomain() : undefined,
			ref: params.get("ref") ?? undefined,
			utm_source: params.get("utm_source") ?? undefined,
			utm_medium: params.get("utm_medium") ?? undefined,
			utm_campaign: params.get("utm_campaign") ?? undefined,
			width: Math.round(win.innerWidth) || undefined,
			language: win.navigator.language || undefined,
		};

		viewId = null;
		viewPath = current;
		sendVitals = isFirstView;
		isFirstView = false;
		engagedMs = 0;
		visibleSince = doc.visibilityState === "visible" ? now() : null;
		maxScroll = scrollPct();

		const reply = (await send("/v1/pv", JSON.parse(JSON.stringify(body)))) as { v?: unknown } | null;
		if (viewPath === current && reply && typeof reply.v === "number") viewId = reply.v;

		if (doc.querySelector("[data-bobby-not-found]")) track("not_found");
	}

	function onClick(event: Event): void {
		if (event.type === "auxclick" && (event as MouseEvent).button !== 1) return;
		const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
		if (!link) return;

		let url: URL;
		try {
			url = new URL(link.href, win.location.href);
		} catch {
			return;
		}
		if (!/^https?:$/.test(url.protocol)) return; // mailto:, tel:, javascript: …

		const file = downloadInfo(url);
		if (file) return track("file_download", file);
		if (url.hostname !== win.location.hostname) track("outbound_click", { domain: url.hostname.replace(/^www\./, "") });
	}

	function onVisibility(): void {
		if (doc.visibilityState === "hidden") {
			if (visibleSince !== null) engagedMs += now() - visibleSince;
			visibleSince = null;
			// Let web-vitals report first (its listeners were added earlier), then send.
			queueMicrotask(leave);
		} else {
			visibleSince = now();
		}
	}

	function onNavigate(): void {
		if (path() !== viewPath) void view();
	}

	function start(): void {
		for (const method of ["pushState", "replaceState"] as const) {
			const original = win.history[method].bind(win.history);
			win.history[method] = (...args: Parameters<History["pushState"]>) => {
				original(...args);
				onNavigate();
			};
		}
		win.addEventListener("popstate", onNavigate);
		win.addEventListener("scroll", () => (maxScroll = Math.max(maxScroll, scrollPct())), { passive: true });
		win.addEventListener("pagehide", leave);
		doc.addEventListener("visibilitychange", onVisibility);
		doc.addEventListener("click", onClick, true);
		doc.addEventListener("auxclick", onClick, true);
		void view();
	}

	return {
		start,
		track,
		/** Called by web-vitals. */
		setVital(name: VitalName, value: number) {
			vitals[name] = name === "cls" ? Math.round(value * 1000) / 1000 : Math.round(value);
		},
	};
}

/**
 * Sets up window.bobby and starts tracking. When tracking is off (GPC, DNT, automation),
 * bobby.track still exists but does nothing, so site code never breaks.
 * Returns the tracker, or null when tracking is off.
 */
export function install({ win, key, send }: { win: Window; key: string | undefined; send: Send }) {
	const w = win as TrackerWindow;
	const queued = Array.isArray(w.bobby?.q) ? (w.bobby!.q as unknown[][]) : [];

	if (!key || !shouldRun(win)) {
		w.bobby = { track() {} };
		return null;
	}

	const tracker = createTracker({ key, win, send });
	w.bobby = { track: (name, props) => tracker.track(name, props) };
	return {
		tracker,
		start() {
			tracker.start();
			for (const args of queued) tracker.track(String(args[0]), (args[1] as Props) ?? {});
		},
	};
}

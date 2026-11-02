import { onCLS, onINP, onLCP } from "web-vitals";
import { install, type Send } from "./core";

// <script defer src="https://…/t.js" data-key="pk_…"></script>
const script = document.currentScript as HTMLScriptElement | null;

if (script) {
	const endpoint = new URL(script.src).origin;

	// text/plain keeps these "simple" requests, so browsers don't send a CORS preflight.
	const send: Send = (path, body) =>
		fetch(endpoint + path, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "text/plain" },
			keepalive: true,
			credentials: "omit",
			mode: "cors",
		})
			.then((response) => (response.status === 200 ? response.json() : null))
			.catch(() => null);

	const installed = install({ win: window, key: script.dataset.key, send });
	if (installed) {
		// Registered before the tracker's own listeners, so final values arrive before the leave beacon.
		onLCP((metric) => installed.tracker.setVital("lcp_ms", metric.value));
		onCLS((metric) => installed.tracker.setVital("cls", metric.value));
		onINP((metric) => installed.tracker.setVital("inp_ms", metric.value));
		installed.start();
	}
}

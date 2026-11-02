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
		installed.start();

		// Core Web Vitals live in a separate file, fetched once the page has finished loading.
		// web-vitals reads buffered performance entries, so nothing from the load is missed.
		const loadVitals = () => {
			const vitals = document.createElement("script");
			vitals.src = `${endpoint}/t-vitals.js`;
			vitals.async = true;
			document.head.appendChild(vitals);
		};
		if (document.readyState === "complete") loadVitals();
		else window.addEventListener("load", loadVitals, { once: true });
	}
}

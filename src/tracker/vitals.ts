import { onCLS, onINP, onLCP } from "web-vitals";
import type { VitalName } from "./core";

// Loaded by t.js after the page has loaded. Does nothing unless t.js is running (it never is
// when Global Privacy Control or Do Not Track is on).
const report = (window as Window & { bobby?: { _vital?: (name: VitalName, value: number) => void } }).bobby?._vital;

if (report) {
	onLCP((metric) => report("lcp_ms", metric.value));
	onCLS((metric) => report("cls", metric.value));
	onINP((metric) => report("inp_ms", metric.value));
}

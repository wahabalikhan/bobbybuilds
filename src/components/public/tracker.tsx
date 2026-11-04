import { site } from "@/lib/site";

/**
 * t.js for the BobbyBuilds project, on the public pages only (home, 404, journey). Never on the
 * admin pages: tests/node/public-tracker.test.ts checks. Same origin, so the public CSP already
 * allows it (script-src 'self', connect-src 'self'). React hoists an async script into the head
 * and loads it once, however many public pages are visited.
 */
export function PublicTracker() {
	return <script async src="/t.js" data-key={site.trackerKey} />;
}

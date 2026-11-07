"use client";

import { useEffect } from "react";
import { IGNORE_KEY } from "@/tracker/ignore";

/**
 * Signed into the admin means it's you: every admin page sets this browser's "don't count my
 * visits" flag for bobbybuilds.app (the admin shares the origin with the public pages), so your
 * own visits to BobbyBuilds are never counted, without a switch. Per browser, no cookies: the same
 * localStorage flag t.js reads (src/tracker/ignore.ts). Only admin pages, behind Cloudflare
 * Access, ever set it.
 */
export function OwnVisitsNotCounted() {
	useEffect(() => {
		try {
			window.localStorage.setItem(IGNORE_KEY, "1");
		} catch {
			// Storage is blocked: nothing to do.
		}
	}, []);
	return null;
}

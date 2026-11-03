"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createTapCounter, handleShortcut } from "@/lib/public/admin-shortcut";
import { adminHref } from "@/lib/site";

const openAdmin = () => window.location.assign(adminHref());

/**
 * Option + A (Alt + A) anywhere on the page goes to `to` in the same tab: the admin from the
 * public site, and the public site from the admin. Same rules both ways (isAdminShortcut). Renders nothing.
 */
export function AdminKeyboardShortcut({ to }: { to?: string } = {}) {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => handleShortcut(event, () => (to ? window.location.assign(to) : openAdmin()));
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [to]);
	return null;
}

/** Five quick taps on its text open the admin dashboard. Looks and reads exactly like plain text. */
export function AdminTaps({ children }: { children: ReactNode }) {
	const counter = useRef(createTapCounter());
	return (
		<span className="select-none [touch-action:manipulation]" onClick={(event) => counter.current.tap(event.timeStamp) && openAdmin()}>
			{children}
		</span>
	);
}

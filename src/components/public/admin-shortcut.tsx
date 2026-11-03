"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createTapCounter, isAdminShortcut } from "@/lib/public/admin-shortcut";
import { adminHref } from "@/lib/site";

const openAdmin = () => window.location.assign(adminHref());

/** Option + A (Alt + A) anywhere on the page opens the admin dashboard. Renders nothing. */
export function AdminKeyboardShortcut() {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!isAdminShortcut(event)) return;
			event.preventDefault();
			openAdmin();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
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

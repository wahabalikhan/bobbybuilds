"use client";

import { useState } from "react";

/** Copies text to the clipboard. The text stays visible and selectable without JavaScript. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			onClick={async () => {
				await navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}}
			className="rounded-lg border border-line px-3 py-1 text-sm hover:bg-[var(--accent-wash)]"
		>
			<span aria-live="polite">{copied ? "Copied" : label}</span>
		</button>
	);
}

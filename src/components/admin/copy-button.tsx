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
			className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm hover:bg-pill"
		>
			<span aria-live="polite">{copied ? "Copied" : label}</span>
		</button>
	);
}

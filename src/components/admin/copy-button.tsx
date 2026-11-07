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
			className="btn-secondary control inline-flex items-center justify-center px-3.5 text-sm"
		>
			<span aria-live="polite">{copied ? "Copied" : label}</span>
		</button>
	);
}

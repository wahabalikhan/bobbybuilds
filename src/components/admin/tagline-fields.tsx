"use client";

import { useState } from "react";
import { TextField, useFieldState } from "./form";

/** A {number} placeholder, like {open_jobs}. */
const PLACEHOLDER = /\{[a-z][a-z0-9_]*\}/;

/**
 * The tagline, and the fallback tagline only while the tagline uses {numbers} (it's only needed
 * then). A hidden fallback keeps its value and is still sent, so nothing is lost by hiding it.
 */
export function TaglineFields({ tagline, fallback }: { tagline: string; fallback: string }) {
	const typed = useFieldState("tagline", tagline);
	const fallbackState = useFieldState("tagline_fallback", fallback);
	const [hasNumbers, setHasNumbers] = useState(PLACEHOLDER.test(typed.value ?? ""));
	return (
		<div
			className="space-y-4"
			onInput={(event) => {
				const target = event.target as HTMLInputElement;
				if (target.name === "tagline") setHasNumbers(PLACEHOLDER.test(target.value));
			}}
		>
			<TextField
				name="tagline"
				label="Tagline"
				defaultValue={tagline}
				maxLength={120}
				hint="Shown on your public page, up to two lines. Numbers you've made public can go in it, like {open_jobs}, filled in with the latest value."
			/>
			<div hidden={!hasNumbers && !fallbackState.error}>
				<TextField name="tagline_fallback" label="Fallback tagline" defaultValue={fallback} maxLength={120} hint="Used when a number in the tagline can't be shown (it's private or over a week old)." />
			</div>
		</div>
	);
}

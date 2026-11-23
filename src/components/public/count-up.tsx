"use client";

import { useEffect, useState } from "react";

/**
 * A number that counts up from 0 once, when the page loads (about 0.9s, easing out). The server
 * renders the final value, so it's right without JavaScript; with reduced motion it never moves.
 * Screen readers get the final value only.
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
	const [shown, setShown] = useState(value);

	useEffect(() => {
		if (value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const start = performance.now();
		const duration = 900;
		let frame = requestAnimationFrame(function tick(now) {
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - (1 - t) ** 3;
			// Whole steps for whole numbers, pence for money.
			setShown(t < 1 ? Math.round(value * eased) : value);
			if (t < 1) frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	}, [value]);

	return (
		<>
			<span aria-hidden>{format(shown)}</span>
			<span className="sr-only">{format(value)}</span>
		</>
	);
}

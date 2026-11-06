"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

/**
 * A journey entry's text, cut to two lines with "Read more" (only when there's more to show), which
 * opens it in place ("Show less" closes it). Screen readers get the whole text either way: the cut is
 * visual only. The html is already sanitised (renderMarkdown, in the snapshot).
 */
export function EntryBody({ html }: { html: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const id = useId();
	const [open, setOpen] = useState(false);
	const [overflows, setOverflows] = useState(false);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || open) return;
		const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
		check();
		const observer = new ResizeObserver(check);
		observer.observe(el);
		return () => observer.disconnect();
	}, [open]);

	return (
		<>
			{/* Safe: renderMarkdown never passes raw HTML through (src/lib/markdown.ts). */}
			<div ref={ref} id={id} className={`prose-bobby mt-2 max-w-[65ch] text-ink-2 ${open ? "" : "line-clamp-2"}`} dangerouslySetInnerHTML={{ __html: html }} />
			{overflows && (
				<button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="link mt-1 text-sm">
					{open ? "Show less" : "Read more"}
				</button>
			)}
		</>
	);
}

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A dialog, after RealTechJobs: a native modal <dialog>, centred, 440px wide (less on phones), 20px
 * corners, a title, a body and buttons at the bottom (secondary on the left, the main one on the
 * right). Escape or the close action closes it and focus goes back to the button that opened it.
 * `trigger` draws that button; `children` gets `close` for a Cancel or Keep button.
 */
export function Dialog({ title, trigger, children }: { title: string; trigger: (open: () => void) => ReactNode; children: (close: () => void) => ReactNode }) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	const [open, setOpen] = useState(false);
	const close = () => setOpen(false);
	// Open and close the native modal from state (it moves focus in, and back out to the trigger).
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);
	return (
		<>
			{trigger(() => setOpen(true))}
			<dialog
				ref={ref}
				aria-labelledby={titleId}
				// Escape closes it natively; keep the state in step.
				onClose={close}
				// Clicking the backdrop (outside the box) closes it too.
				onClick={(event) => {
					if (event.target === event.currentTarget) close();
				}}
				className="w-[min(440px,calc(100vw-32px))] rounded-[20px] border border-line bg-card p-0 text-ink shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop:bg-black/40"
			>
				<div className="p-5">
					<h2 id={titleId} className="text-lg font-semibold tracking-tight">
						{title}
					</h2>
					<div className="mt-3">{children(close)}</div>
				</div>
			</dialog>
		</>
	);
}

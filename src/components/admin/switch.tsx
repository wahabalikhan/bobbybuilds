/** A switch: a real checkbox (so the form posts it), drawn as a toggle. */
export function Switch({ id, name, label, hint, checked }: { id: string; name: string; label: string; hint: string; checked: boolean }) {
	return (
		<label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3">
			<span className="text-sm">
				<span className="font-medium">{label}</span>
				<span className="block text-muted">{hint}</span>
			</span>
			<span className="relative mt-0.5 inline-flex shrink-0">
				<input type="checkbox" role="switch" id={id} name={name} defaultChecked={checked} className="peer sr-only" />
				<span aria-hidden className="h-6 w-10 rounded-full bg-[var(--axis)] transition-colors peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)]" />
				<span aria-hidden className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
			</span>
		</label>
	);
}

"use client";

/** A select that submits its GET form on change. Works without JavaScript via the button. */
export function AutoSubmitSelect({
	name,
	label,
	value,
	options,
	hidden = {},
}: {
	name: string;
	label: string;
	value: string;
	options: { value: string; label: string }[];
	hidden?: Record<string, string>;
}) {
	return (
		<form method="get" className="flex items-center gap-2">
			{Object.entries(hidden).map(([key, v]) => (
				<input key={key} type="hidden" name={key} value={v} />
			))}
			<label className="sr-only" htmlFor={`select-${name}`}>
				{label}
			</label>
			<select
				id={`select-${name}`}
				name={name}
				defaultValue={value}
				onChange={(event) => event.currentTarget.form?.requestSubmit()}
				className="appearance-none rounded-full border border-line bg-card bg-[length:12px] bg-[right_12px_center] bg-no-repeat py-1.5 pl-3.5 pr-8 text-sm"
				style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%2371717a' stroke-width='1.5'/%3E%3C/svg%3E\")" }}
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			<noscript>
				<button className="rounded-full border border-line px-3 py-1.5 text-sm">Show</button>
			</noscript>
		</form>
	);
}

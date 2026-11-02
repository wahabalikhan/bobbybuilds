"use client";

import { useState, useTransition } from "react";
import { previewMarkdownAction } from "@/app/admin/settings/actions";
import { TextArea } from "./form";

/** Markdown body with a preview rendered on the server by the same sanitiser the public pages use. */
export function JourneyBody({ defaultValue }: { defaultValue: string }) {
	const [html, setHtml] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	return (
		<div className="space-y-2">
			<TextArea name="body_md" label="Entry" rows={16} defaultValue={defaultValue} hint="Markdown: **bold**, _italic_, [links](https://…), lists, `code`. Raw HTML is shown as text." />
			<button
				type="button"
				onClick={(event) => {
					const textarea = event.currentTarget.form?.elements.namedItem("body_md") as HTMLTextAreaElement | null;
					startTransition(async () => setHtml(await previewMarkdownAction(textarea?.value ?? "")));
				}}
				className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm hover:bg-pill"
			>
				{pending ? "Rendering…" : "Preview"}
			</button>
			{html !== null && (
				<div className="rounded-2xl border border-line bg-surface p-5">
					<p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
					{/* Safe: renderMarkdown never passes raw HTML through (src/lib/markdown.ts). */}
					<div className="prose-bobby" dangerouslySetInnerHTML={{ __html: html || "<p><em>Nothing to preview yet.</em></p>" }} />
				</div>
			)}
		</div>
	);
}

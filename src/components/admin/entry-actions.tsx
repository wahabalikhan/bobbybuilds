"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { journeyAction, journeyStatusAction } from "@/app/admin/settings/actions";
import type { FormState } from "@/lib/admin/form-state";
import { Dialog } from "./dialog";
import { showToast } from "./toast";
import { buttonClass, quietButtonClass } from "./ui";

const idle: FormState = { status: "idle", version: 0 };
const danger = "control inline-flex items-center justify-center px-4 text-sm font-medium";

/**
 * An entry's three actions, under its view: Edit, Publish (drafts) or Unpublish, and Delete, which
 * asks first in a dialog. The main one sits on the far right (Publish for a draft, Edit for a
 * published entry); the rest on the left. Publishing and unpublishing happen straight away, with
 * a toast.
 */
export function EntryActions({ id, published, editHref }: { id: number; published: boolean; editHref: string }) {
	const [state, setStatus, pending] = useActionState(journeyStatusAction, idle);
	useEffect(() => {
		if (state.status === "idle" || !state.message) return;
		showToast(state.status === "ok" ? "success" : "error", state.message);
	}, [state]);

	const statusForm = (label: string, main: boolean) => (
		<form action={setStatus}>
			<input type="hidden" name="entry_id" value={id} />
			<input type="hidden" name="publish" value={published ? "off" : "on"} />
			<button disabled={pending} className={main ? buttonClass : quietButtonClass}>
				{pending ? "Saving…" : label}
			</button>
		</form>
	);

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex flex-wrap items-center gap-3">
				{published ? (
					statusForm("Unpublish", false)
				) : (
					<Link href={editHref} className={quietButtonClass}>
						Edit
					</Link>
				)}
				<Dialog
					title="Delete this entry?"
					trigger={(open) => (
						<button type="button" onClick={open} className={`btn-danger-outline ${danger}`}>
							Delete
						</button>
					)}
				>
					{(close) => <DeleteForm id={id} close={close} />}
				</Dialog>
			</div>
			<div className="ml-auto flex items-center gap-3">
				{published ? (
					<Link href={editHref} className={buttonClass}>
						Edit
					</Link>
				) : (
					statusForm("Publish", true)
				)}
			</div>
		</div>
	);
}

/** The dialog's body: what happens, then Keep (left) and the red "Delete entry" (right). */
function DeleteForm({ id, close }: { id: number; close: () => void }) {
	const [state, remove, pending] = useActionState(journeyAction, idle);
	return (
		<form action={remove} className="space-y-5">
			<input type="hidden" name="entry_id" value={id} />
			<input type="hidden" name="intent" value="delete" />
			<input type="hidden" name="confirm" value="on" />
			<p className="text-sm text-ink-2">It&rsquo;s taken off your public page straight away. This can&rsquo;t be undone.</p>
			{state.status === "error" && state.message && <p className="text-sm text-danger">{state.message}</p>}
			<div className="flex items-center justify-between gap-3">
				<button type="button" onClick={close} className={quietButtonClass}>
					Keep
				</button>
				<button disabled={pending} className={`btn-danger ${danger}`}>
					{pending ? "Deleting…" : "Delete entry"}
				</button>
			</div>
		</form>
	);
}

import type { Errors, FormValues } from "./validate";

/** What a settings action returns to its form. */
export type FormState = {
	status: "idle" | "ok" | "error";
	/** Changes on every submission, so the form re-reads its values. */
	version: number;
	message?: string;
	notes?: string[];
	errors?: Errors;
	/** What was typed, kept when something needs fixing. */
	values?: FormValues;
	/** A new secret key, shown once. */
	secret?: string;
	/** After step 1 of a new project: what step 2 shows (the snippet) and step 3 waits on. */
	setup?: { slug: string; name: string; publicKey: string; snippet: string };
};

export function ok(previous: FormState, message: string, notes: string[] = [], extra: Partial<FormState> = {}): FormState {
	return { status: "ok", version: previous.version + 1, message, notes, ...extra };
}

export function failed(previous: FormState, values: FormValues, errors: Errors, message = "Please fix the highlighted fields."): FormState {
	return { status: "error", version: previous.version + 1, message, errors, values };
}

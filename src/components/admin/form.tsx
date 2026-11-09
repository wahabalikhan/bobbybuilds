"use client";

/**
 * Settings forms. <SettingsForm> runs a server action with useActionState and shares the
 * result with the fields inside it (errors, and the values you typed if something needs fixing).
 * Fields are plain inputs, so forms also work before JavaScript loads.
 */
import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/admin/form-state";
import { CopyButton } from "./copy-button";
import { inputBaseClass, inputClass, selectClass, textAreaClass } from "./field-styles";
import { Notice, ToneIcon } from "./message";

export { inputBaseClass, inputClass, selectBaseClass, selectClass, textAreaClass } from "./field-styles";
import { showToast } from "./toast";

export type { FormState } from "@/lib/admin/form-state";

const StateContext = createContext<FormState>({ status: "idle", version: 0 });

/** A second way to submit the same form, sending `name=value` with it (e.g. "Save draft" next to "Publish"). */
export type FormButton = { label: string; name: string; value: string; quiet?: boolean };

function SubmitButton({ label, danger, name, value, quiet }: { label: string; danger?: boolean; name?: string; value?: string; quiet?: boolean }) {
	const { pending, data } = useFormStatus();
	// With several buttons, only the one that was pressed says "Saving…".
	const pressed = pending && (!name || data?.get(name) === value);
	const look = danger ? "btn-danger-outline" : quiet ? "btn-secondary" : "btn-primary";
	return (
		<button name={name} value={value} disabled={pending} className={`control inline-flex items-center justify-center px-4 text-sm font-medium ${look}`}>
			{pressed ? "Saving…" : label}
		</button>
	);
}

export function SettingsForm({
	action,
	children,
	submitLabel = "Save",
	danger = false,
	className = "",
	buttons,
}: {
	action: (state: FormState, form: FormData) => Promise<FormState>;
	children: ReactNode;
	submitLabel?: string;
	danger?: boolean;
	className?: string;
	/** Instead of the one submit button: several, each sending its own name=value. */
	buttons?: FormButton[];
}) {
	const [state, formAction] = useActionState(action, { status: "idle", version: 0 } satisfies FormState);
	// A save that worked is a toast (green; amber when it came with a note to read). A problem
	// stays in place: under its field, and once above the buttons.
	const toasted = useRef(0);
	useEffect(() => {
		if (state.status !== "ok" || !state.message || toasted.current === state.version) return;
		toasted.current = state.version;
		const notes = state.notes ?? [];
		showToast(notes.length ? "warning" : "success", [state.message, ...notes].join(" "));
	}, [state]);
	return (
		<StateContext.Provider value={state}>
			<form key={state.version} action={formAction} className={`space-y-4 ${className}`} noValidate>
				{children}
				<FormProblem state={state} />
				{/* Secondary (outlined) actions on the left; the one main action on the far right. */}
				<div className="flex flex-wrap items-center justify-between gap-3 pt-1">
					<div className="flex flex-wrap items-center gap-3">
						{buttons?.filter((b) => b.quiet).map((b) => <SubmitButton key={b.label} label={b.label} name={b.name} value={b.value} quiet />)}
					</div>
					<div className="ml-auto flex flex-wrap items-center gap-3">
						{buttons ? buttons.filter((b) => !b.quiet).map((b) => <SubmitButton key={b.label} label={b.label} name={b.name} value={b.value} />) : <SubmitButton label={submitLabel} danger={danger} />}
					</div>
				</div>
				{state.secret && <SecretOnce secret={state.secret} />}
			</form>
		</StateContext.Provider>
	);
}

/** A problem saving the form: once, just above its buttons (red), with any notes. */
function FormProblem({ state }: { state: FormState }) {
	if (state.status !== "error" || !state.message) return null;
	return (
		<Notice tone="error">
			<p>{state.message}</p>
			{state.notes?.map((note) => (
				<p key={note}>{note}</p>
			))}
		</Notice>
	);
}

function SecretOnce({ secret }: { secret: string }) {
	return (
		<div role="alert" className="rounded-2xl border border-line bg-surface p-4">
			<p className="font-medium">Copy your secret key now. It won&rsquo;t be shown again.</p>
			<p className="mt-1 text-sm text-ink-2">
				Save it in the product&rsquo;s secrets, never in its code.
			</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<input readOnly value={secret} aria-label="Secret key" className={`${inputBaseClass} min-w-0 flex-1 font-mono`} />
				<CopyButton text={secret} label="Copy secret key" />
			</div>
		</div>
	);
}

/** A field's error and current value (what was typed, after a failed save), for custom fields. */
export function useFieldState(name: string, defaultValue: string | undefined) {
	return useField(name, defaultValue);
}

function useField(name: string, defaultValue: string | undefined) {
	const state = useContext(StateContext);
	const error = state.errors?.[name];
	const value = state.status === "error" && state.values && name in state.values ? state.values[name] : defaultValue;
	return { error, value, id: `field-${name}` };
}

/**
 * Every field follows the New project form: the label (14px medium), the field, then its hint
 * under it (14px grey), then any error. Never a hint beside or above the field.
 */
function Label({ id, label, srOnly }: { id: string; label: string; srOnly?: boolean }) {
	return (
		<label htmlFor={id} className={srOnly ? "sr-only" : "block text-sm font-medium"}>
			{label}
		</label>
	);
}

function Hint({ id, hint }: { id: string; hint?: ReactNode }) {
	if (!hint) return null;
	return (
		<p id={id} className="mt-1 text-sm text-muted">
			{hint}
		</p>
	);
}

/** A field's error, under it: red, with the warning icon (after RealTechJobs' FieldError). */
function ErrorText({ id, error }: { id: string; error?: string }) {
	if (!error) return null;
	return (
		<p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
			<ToneIcon tone="warning" className="mt-0.5 h-4 w-4" />
			{error}
		</p>
	);
}

type FieldProps = {
	name: string;
	label: string;
	defaultValue?: string;
	hint?: ReactNode;
	placeholder?: string;
	maxLength?: number;
	required?: boolean;
	/** For rows under a visible column heading: the label is for screen readers only. */
	srLabel?: boolean;
};

export function TextField({ type = "text", list, inputMode, ...props }: FieldProps & { type?: "text" | "url" | "number" | "date" | "month"; list?: string; inputMode?: "decimal" }) {
	const { error, value, id } = useField(props.name, props.defaultValue);
	return (
		<div>
			<Label id={id} label={props.label} srOnly={props.srLabel} />
			<input
				id={id}
				name={props.name}
				type={type}
				list={list}
				inputMode={inputMode}
				defaultValue={value}
				placeholder={props.placeholder}
				maxLength={props.maxLength}
				required={props.required}
				aria-invalid={error ? true : undefined}
				aria-describedby={[props.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
				className={inputClass}
			/>
			<Hint id={`${id}-hint`} hint={props.hint} />
			<ErrorText id={`${id}-error`} error={error} />
		</div>
	);
}

export function TextArea({ rows = 4, mono = false, ...props }: FieldProps & { rows?: number; mono?: boolean }) {
	const { error, value, id } = useField(props.name, props.defaultValue);
	return (
		<div>
			<Label id={id} label={props.label} srOnly={props.srLabel} />
			<textarea
				id={id}
				name={props.name}
				rows={rows}
				defaultValue={value}
				placeholder={props.placeholder}
				maxLength={props.maxLength}
				aria-invalid={error ? true : undefined}
				aria-describedby={[props.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
				className={`${textAreaClass} ${mono ? "font-mono" : ""}`}
			/>
			<Hint id={`${id}-hint`} hint={props.hint} />
			<ErrorText id={`${id}-error`} error={error} />
		</div>
	);
}

export function SelectField({ options, ...props }: FieldProps & { options: { value: string; label: string }[] }) {
	const { error, value, id } = useField(props.name, props.defaultValue);
	return (
		<div>
			<Label id={id} label={props.label} srOnly={props.srLabel} />
			<select id={id} name={props.name} defaultValue={value} aria-invalid={error ? true : undefined} aria-describedby={[props.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined} className={selectClass}>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			<Hint id={`${id}-hint`} hint={props.hint} />
			<ErrorText id={`${id}-error`} error={error} />
		</div>
	);
}

export function CheckboxField({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: ReactNode }) {
	const state = useContext(StateContext);
	const checked = state.status === "error" && state.values ? state.values[name] === "on" : defaultChecked;
	return (
		<label className="flex items-start gap-2 text-sm">
			<input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-4 w-4 accent-[var(--ink)]" />
			<span>
				{label}
				{hint && <span className="mt-1 block text-muted">{hint}</span>}
			</span>
		</label>
	);
}

/** Shows an error for a key that isn't a single field (e.g. a funnel row). */
export function FieldError({ name }: { name: string }) {
	const state = useContext(StateContext);
	const error = state.errors?.[name];
	return error ? (
		<p className="flex items-start gap-1.5 text-sm text-danger">
			<ToneIcon tone="warning" className="mt-0.5 h-4 w-4" />
			{error}
		</p>
	) : null;
}

export function Hidden({ name, value }: { name: string; value: string | number }) {
	return <input type="hidden" name={name} value={String(value)} />;
}

"use client";

/**
 * Settings forms. <SettingsForm> runs a server action with useActionState and shares the
 * result with the fields inside it (errors, and the values you typed if something needs fixing).
 * Fields are plain inputs, so forms also work before JavaScript loads.
 */
import { createContext, useActionState, useContext, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/admin/form-state";
import { CopyButton } from "./copy-button";

export type { FormState } from "@/lib/admin/form-state";

const StateContext = createContext<FormState>({ status: "idle", version: 0 });

export const inputClass =
	"mt-1.5 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted aria-[invalid=true]:border-critical";

function SubmitButton({ label, danger }: { label: string; danger?: boolean }) {
	const { pending } = useFormStatus();
	return (
		<button
			disabled={pending}
			className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60 ${danger ? "bg-critical text-white" : "bg-ink text-page hover:opacity-85"}`}
		>
			{pending ? "Saving…" : label}
		</button>
	);
}

export function SettingsForm({
	action,
	children,
	submitLabel = "Save",
	danger = false,
	className = "",
}: {
	action: (state: FormState, form: FormData) => Promise<FormState>;
	children: ReactNode;
	submitLabel?: string;
	danger?: boolean;
	className?: string;
}) {
	const [state, formAction] = useActionState(action, { status: "idle", version: 0 } satisfies FormState);
	return (
		<StateContext.Provider value={state}>
			<form key={state.version} action={formAction} className={`space-y-4 ${className}`} noValidate>
				{children}
				<div className="flex flex-wrap items-center gap-3 pt-1">
					<SubmitButton label={submitLabel} danger={danger} />
					<StatusMessage state={state} />
				</div>
				{state.secret && <SecretOnce secret={state.secret} />}
			</form>
		</StateContext.Provider>
	);
}

function StatusMessage({ state }: { state: FormState }) {
	if (state.status === "idle" || !state.message) return null;
	const ok = state.status === "ok";
	return (
		<div role={ok ? "status" : "alert"} className="text-sm">
			<p className={ok ? "text-good-ink" : "text-critical-ink"}>
				<span aria-hidden>{ok ? "✓ " : "✕ "}</span>
				{state.message}
			</p>
			{state.notes?.map((note) => (
				<p key={note} className="text-muted">
					{note}
				</p>
			))}
		</div>
	);
}

function SecretOnce({ secret }: { secret: string }) {
	return (
		<div role="alert" className="rounded-2xl border border-line bg-surface p-4">
			<p className="font-medium">Copy your secret key now. It won&rsquo;t be shown again.</p>
			<p className="mt-1 text-sm text-ink-2">
				Only its hash is stored. Put it in the product&rsquo;s own secrets (for example <code>npx wrangler secret put BOBBY_SECRET_KEY</code>), never in browser code or Git.
			</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<input readOnly value={secret} aria-label="Secret key" className={`${inputClass} mt-0 min-w-0 flex-1 font-mono`} />
				<CopyButton text={secret} label="Copy secret key" />
			</div>
		</div>
	);
}

function useField(name: string, defaultValue: string | undefined) {
	const state = useContext(StateContext);
	const error = state.errors?.[name];
	const value = state.status === "error" && state.values && name in state.values ? state.values[name] : defaultValue;
	return { error, value, id: `field-${name}` };
}

function Label({ id, label, hint, error, srOnly }: { id: string; label: string; hint?: ReactNode; error?: string; srOnly?: boolean }) {
	return (
		<>
			<label htmlFor={id} className={srOnly ? "sr-only" : "block text-sm font-medium"}>
				{label}
			</label>
			{hint && (
				<p id={`${id}-hint`} className="mt-0.5 text-xs text-muted">
					{hint}
				</p>
			)}
			{error && (
				<p id={`${id}-error`} className="mt-1 text-sm text-critical-ink">
					{error}
				</p>
			)}
		</>
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
			<Label id={id} label={props.label} hint={props.hint} error={error} srOnly={props.srLabel} />
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
		</div>
	);
}

export function TextArea({ rows = 4, mono = false, ...props }: FieldProps & { rows?: number; mono?: boolean }) {
	const { error, value, id } = useField(props.name, props.defaultValue);
	return (
		<div>
			<Label id={id} label={props.label} hint={props.hint} error={error} srOnly={props.srLabel} />
			<textarea
				id={id}
				name={props.name}
				rows={rows}
				defaultValue={value}
				placeholder={props.placeholder}
				maxLength={props.maxLength}
				aria-invalid={error ? true : undefined}
				aria-describedby={[props.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
				className={`${inputClass} ${mono ? "font-mono" : ""}`}
			/>
		</div>
	);
}

export function SelectField({ options, ...props }: FieldProps & { options: { value: string; label: string }[] }) {
	const { error, value, id } = useField(props.name, props.defaultValue);
	return (
		<div>
			<Label id={id} label={props.label} hint={props.hint} error={error} srOnly={props.srLabel} />
			<select id={id} name={props.name} defaultValue={value} aria-invalid={error ? true : undefined} className={inputClass}>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
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
				{hint && <span className="block text-xs text-muted">{hint}</span>}
			</span>
		</label>
	);
}

/** Shows an error for a key that isn't a single field (e.g. a funnel row). */
export function FieldError({ name }: { name: string }) {
	const state = useContext(StateContext);
	const error = state.errors?.[name];
	return error ? <p className="text-sm text-critical-ink">{error}</p> : null;
}

export function Hidden({ name, value }: { name: string; value: string | number }) {
	return <input type="hidden" name={name} value={String(value)} />;
}

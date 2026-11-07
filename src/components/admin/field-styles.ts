/**
 * Field classes, in a plain module (not "use client"), so server pages can use the strings too:
 * importing them from form.tsx on the server gives a client reference, not the class names.
 */
/** Every text field, after Tech Jobs: one shape (`control`, 10px corners, 40px tall; 44px on phones) and the field border. */
export const inputBaseClass = "control border border-field bg-card px-3 text-sm text-ink placeholder:text-muted aria-[invalid=true]:border-danger";
export const inputClass = `${inputBaseClass} mt-1.5 w-full`;

/** Text areas: the same corners and border, as tall as their rows. */
export const textAreaClass = "rounded-control mt-1.5 w-full border border-field bg-card px-3 py-2 text-sm text-ink placeholder:text-muted aria-[invalid=true]:border-danger";

/** The one dropdown style: the field shape with a chevron (.select-chevron in globals.css). */
export const selectBaseClass = "control select-chevron border border-field bg-card pl-3 text-sm text-ink aria-[invalid=true]:border-danger";
export const selectClass = `${selectBaseClass} mt-1.5 w-full`;


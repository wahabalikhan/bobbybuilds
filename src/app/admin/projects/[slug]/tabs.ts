/** A project's two tabs. Old ?tab= values (Traffic, Health…) show the Overview; only "settings" picks Settings. */
export const PROJECT_TABS = [
	{ key: "overview", label: "Overview" },
	{ key: "settings", label: "Settings" },
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number]["key"];

export function tabFor(value: string | undefined): ProjectTab {
	return value === "settings" ? "settings" : "overview";
}

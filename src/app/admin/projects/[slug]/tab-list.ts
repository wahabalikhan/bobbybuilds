/** The project dashboard's tabs, in order. Searches, Funnel and Product numbers only appear when there's something to show. */
const ALL = [
	{ key: "traffic", label: "Traffic" },
	{ key: "links", label: "Tracked links" },
	{ key: "searches", label: "Searches" },
	{ key: "funnel", label: "Funnel" },
	{ key: "numbers", label: "Product numbers" },
	{ key: "health", label: "Health" },
	{ key: "events", label: "Events" },
] as const;

export type TabKey = (typeof ALL)[number]["key"];

export function availableTabs(has: { hasSearches: boolean; hasFunnel: boolean; hasProductNumbers: boolean }): { key: TabKey; label: string }[] {
	return ALL.filter((t) => (t.key === "searches" ? has.hasSearches : t.key === "funnel" ? has.hasFunnel : t.key === "numbers" ? has.hasProductNumbers : true));
}

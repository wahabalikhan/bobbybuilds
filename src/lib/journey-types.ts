/** Journey entry types, in the order the filter chips show them. Used by the admin and the public page. */
export const JOURNEY_TYPES = [
	{ value: "shipped", label: "Shipped", emoji: "🚀" },
	{ value: "decision", label: "Decision", emoji: "🤔" },
	{ value: "lesson", label: "Lesson", emoji: "💡" },
	{ value: "post", label: "Post", emoji: "✍️" },
	{ value: "inspired", label: "Inspired by", emoji: "✨" },
	{ value: "report", label: "Monthly report", emoji: "📊" },
] as const;

export type JourneyType = (typeof JOURNEY_TYPES)[number]["value"];

export function journeyType(value: string) {
	return JOURNEY_TYPES.find((t) => t.value === value) ?? JOURNEY_TYPES[3];
}

/** "A few sentences": the public timeline shows each entry in full. */
export const JOURNEY_BODY_MAX = 600;

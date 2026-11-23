/**
 * Journey entry types, in the order the filter chips show them. Used by the admin (with the emoji)
 * and the public pages (with the tone: the pill's colours, `.public-theme` tokens in globals.css).
 * Monthly reports are the main building-in-public posts, so theirs is the dark ink pill.
 */
export const JOURNEY_TYPES = [
	{ value: "shipped", label: "Shipped", emoji: "🚀", tone: "shipped" },
	{ value: "building", label: "Building", emoji: "🛠", tone: "building" },
	{ value: "decision", label: "Decision", emoji: "🤔", tone: "decision" },
	{ value: "lesson", label: "Lesson", emoji: "💡", tone: "plain" },
	{ value: "post", label: "Post", emoji: "✍️", tone: "plain" },
	{ value: "inspired", label: "Inspired by", emoji: "✨", tone: "inspired" },
	{ value: "report", label: "Monthly report", emoji: "📊", tone: "ink" },
] as const;

export type JourneyTone = (typeof JOURNEY_TYPES)[number]["tone"];

export type JourneyType = (typeof JOURNEY_TYPES)[number]["value"];

export function journeyType(value: string) {
	return JOURNEY_TYPES.find((t) => t.value === value) ?? JOURNEY_TYPES[3];
}

/** "A few sentences": the public timeline shows each entry in full. */
export const JOURNEY_BODY_MAX = 600;

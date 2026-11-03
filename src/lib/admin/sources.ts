/**
 * Where visitors came from, in plain words: a referrer's domain ("www.linkedin.com", "lnkd.in")
 * or a utm_source ("linkedin") becomes "LinkedIn". Anything not known is shown as its domain.
 */
const KNOWN: [RegExp, string][] = [
	[/(^|\.)(linkedin\.com|lnkd\.in)$|^linkedin$/, "LinkedIn"],
	[/(^|\.)google\.[a-z.]+$|^google$/, "Google"],
	[/(^|\.)bing\.com$|^bing$/, "Bing"],
	[/(^|\.)duckduckgo\.com$|^duckduckgo$/, "DuckDuckGo"],
	[/(^|\.)(x\.com|twitter\.com|t\.co)$|^(x|twitter)$/, "X (Twitter)"],
	[/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com)$|^facebook$/, "Facebook"],
	[/(^|\.)instagram\.com$|^instagram$/, "Instagram"],
	[/(^|\.)reddit\.com$|^reddit$/, "Reddit"],
	[/^news\.ycombinator\.com$|^(hn|hackernews|hacker-news)$/, "Hacker News"],
	[/(^|\.)github\.com$|^github$/, "GitHub"],
	[/(^|\.)(youtube\.com|youtu\.be)$|^youtube$/, "YouTube"],
	[/(^|\.)(chatgpt\.com|chat\.openai\.com)$|^chatgpt$/, "ChatGPT"],
	[/(^|\.)perplexity\.ai$|^perplexity$/, "Perplexity"],
	[/(^|\.)claude\.ai$|^claude$/, "Claude"],
	[/(^|\.)bsky\.app$|^bluesky$/, "Bluesky"],
	[/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com)$|^(email|newsletter)$/, "Email"],
	[/(^|\.)bobbybuilds\.app$/, "Bobby Builds"],
];

export function sourceName(value: string): string {
	const key = value.trim().toLowerCase().replace(/^www\./, "");
	if (!key) return "Direct or unknown";
	for (const [pattern, name] of KNOWN) if (pattern.test(key)) return name;
	return key;
}

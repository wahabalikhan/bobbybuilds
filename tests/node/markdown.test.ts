import { describe, expect, it } from "vitest";
import { renderMarkdown, safeImageUrl, safeLinkUrl } from "@/lib/markdown";

const ALLOWED_TAGS = new Set(["p", "a", "strong", "em", "del", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr", "br", "img", "table", "thead", "tbody", "tr", "th", "td", "input"]);
const ALLOWED_ATTRIBUTES = new Set(["href", "title", "rel", "src", "alt", "loading", "align", "start", "type", "checked", "disabled", "class"]);

/** Parses the real tags (not escaped text) and checks every tag, attribute and URL. */
const noActiveContent = (html: string) => {
	for (const [, name, attributes] of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)) {
		expect(ALLOWED_TAGS, `tag <${name}>`).toContain(name.toLowerCase());
		if (name.toLowerCase() === "input") expect(attributes).toMatch(/type="checkbox"/); // GFM task lists only
		const rest = attributes.replace(/\s([a-zA-Z-]+)(="[^"]*")?/g, (_m, attr: string, value?: string) => {
			expect(ALLOWED_ATTRIBUTES, `attribute ${attr}`).toContain(attr.toLowerCase());
			if ((attr === "href" || attr === "src") && value) expect(value).toMatch(/^="(https?:|mailto:|\/(?!\/)|#)/);
			return "";
		});
		expect(rest.replace(/\s*\/?$/, ""), `leftover in <${name}${attributes}>`).toBe("");
	}
};

describe("renderMarkdown", () => {
	it("renders ordinary Markdown", () => {
		const html = renderMarkdown("# Week one\n\nI **shipped** the [job board](https://jobboard.example/) and wrote [notes](/journey/notes).\n\n- one\n- two\n\n`code`");
		expect(html).toContain("<h1>Week one</h1>");
		expect(html).toContain("<strong>shipped</strong>");
		expect(html).toContain('<a href="https://jobboard.example/" rel="noopener noreferrer">job board</a>');
		expect(html).toContain('<a href="/journey/notes">notes</a>');
		expect(html).toContain("<li>one</li>");
		expect(html).toContain("<code>code</code>");
	});

	it.each([
		["a script tag", "<script>alert(1)</script>"],
		["an inline script tag", "Hello <script>alert(1)</script> there"],
		["an image with onerror", '<img src=x onerror="alert(1)">'],
		["an svg with onload", "<svg onload=alert(1)>"],
		["an iframe", '<iframe src="https://evil.example"></iframe>'],
		["a raw link with javascript:", '<a href="javascript:alert(1)">x</a>'],
		["a style tag", "<style>body{display:none}</style>"],
		["a form", '<form action="https://evil.example"><input name=x></form>'],
		["a Markdown javascript: link", "[click](javascript:alert(1))"],
		["a mixed-case javascript: link", "[click](JaVaScRiPt:alert(1))"],
		["a javascript: link hidden with entities", "[click](javascript&#58;alert(1))"],
		["a javascript: link hidden with a tab", "[click](java\tscript:alert(1))"],
		["a data: link", "[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
		["a vbscript: link", "[click](vbscript:msgbox(1))"],
		["a javascript: image", "![x](javascript:alert(1))"],
		["an external image", "![x](https://evil.example/track.gif)"],
		["a protocol-relative image", "![x](//evil.example/track.gif)"],
		["a reference-style javascript: link", "[click][a]\n\n[a]: javascript:alert(1)"],
		["an autolink with javascript:", "<javascript:alert(1)>"],
		["an attribute breakout in a title", '[x](https://ok.example "a\\" onmouseover=\\"alert(1)")'],
	])("never lets through %s", (_label, source) => {
		noActiveContent(renderMarkdown(source));
	});

	it("shows raw HTML as text rather than dropping it", () => {
		expect(renderMarkdown("<b>bold?</b>")).toContain("&lt;b&gt;bold?&lt;/b&gt;");
	});

	it("keeps the text of a refused link", () => {
		expect(renderMarkdown("[click me](javascript:alert(1))")).toContain("click me");
	});

	it("allows same-site images", () => {
		expect(renderMarkdown("![Dashboard](/images/dash.png)")).toContain('<img src="/images/dash.png" alt="Dashboard" loading="lazy">');
	});
});

describe("URL rules", () => {
	it("allows http(s), mailto and same-site paths only", () => {
		expect(safeLinkUrl("https://a.example/x")).toEqual({ href: "https://a.example/x", external: true });
		expect(safeLinkUrl("mailto:hello@example.com")?.external).toBe(false);
		expect(safeLinkUrl("/about")).toEqual({ href: "/about", external: false });
		expect(safeLinkUrl("#top")).toEqual({ href: "#top", external: false });
		expect(safeLinkUrl("//evil.example")).toBeNull();
		expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
		expect(safeLinkUrl(" javascript:alert(1)")).toBeNull();
		expect(safeLinkUrl("ftp://a.example")).toBeNull();
		expect(safeImageUrl("/logo.png")).toBe("/logo.png");
		expect(safeImageUrl("https://a.example/x.png")).toBeNull();
	});
});

import { describe, expect, it } from "vitest";
import { handleEvent } from "@/lib/collector/events";
import { createSecretKey } from "@/lib/keys";
import { browserRequest, count, fakeLimiter, keyedProject, rows, serverRequest, testDeps } from "./helpers";

function browserEvent(key: string, name: string, props: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
	return { key, name, path: "/case-studies/hiring", props, ...extra };
}

const send = (body: unknown, options = {}, deps = testDeps()) => handleEvent(browserRequest("/v1/events", body, options), deps);

describe("/v1/events from the browser", () => {
	it("records an allowlisted event with the visitor ID", async () => {
		const project = await keyedProject();
		const response = await send(browserEvent(project.publicKey, "case_study_read", { study: "hiring" }));
		expect(response.status).toBe(204);
		const [row] = await rows("events", project.id);
		expect(row).toMatchObject({ source: "browser", name: "case_study_read", path: "/case-studies/hiring", props: '{"study":"hiring"}' });
		expect(row.visitor_id).toMatch(/^[0-9a-f]{64}$/);
	});

	it("refuses an event that isn't on the project's allowlist", async () => {
		const project = await keyedProject();
		const response = await send(browserEvent(project.publicKey, "account_deleted"));
		expect(response.status).toBe(403);
		expect(await count("events", project.id)).toBe(0);
	});

	it("refuses a wrong key or origin", async () => {
		const project = await keyedProject();
		expect((await send(browserEvent("pk_" + "z".repeat(24), "case_study_read"))).status).toBe(403);
		expect((await send(browserEvent(project.publicKey, "case_study_read"), { origin: "https://evil.example" })).status).toBe(403);
		expect((await send(browserEvent(project.publicKey, "case_study_read"), { origin: null })).status).toBe(403);
		expect(await count("events", project.id)).toBe(0);
	});

	it.each([
		["Global Privacy Control", { "Sec-GPC": "1" }],
		["Do Not Track", { DNT: "1" }],
	])("stores nothing when %s is on", async (_label, headers) => {
		const project = await keyedProject();
		expect((await send(browserEvent(project.publicKey, "case_study_read"), { headers })).status).toBe(204);
		expect(await count("events", project.id)).toBe(0);
	});

	it("is rate limited", async () => {
		const project = await keyedProject();
		const response = await send(browserEvent(project.publicKey, "case_study_read"), {}, testDeps({ limiter: fakeLimiter(false) }));
		expect(response.status).toBe(429);
	});

	it.each([
		["an email address in props", { by: "jo@example.com" }],
		["a phone number in props", { phone: "+44 7700 900123" }],
		["a prop value over 100 characters", { note: "x".repeat(101) }],
		["more than 10 props", Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`p${i}`, i]))],
		["a nested object", { study: { id: 1 } }],
		["a prop key with capitals", { Study: "hiring" }],
	])("refuses %s", async (_label, props) => {
		const project = await keyedProject();
		expect((await send(browserEvent(project.publicKey, "case_study_read", props))).status).toBe(400);
		expect(await count("events", project.id)).toBe(0);
	});

	it("refuses a bad event name or path", async () => {
		const project = await keyedProject();
		expect((await send(browserEvent(project.publicKey, "Case Study Read"))).status).toBe(400);
		expect((await send(browserEvent(project.publicKey, "case_study_read", {}, { path: "jobs" }))).status).toBe(400);
		expect((await send(browserEvent(project.publicKey, "case_study_read", {}, { path: undefined }))).status).toBe(400);
	});
});

describe("built-in browser events (no allowlist needed)", () => {
	it("records an outbound click with the destination domain only", async () => {
		const project = await keyedProject({ browser_events: "[]" });
		expect((await send(browserEvent(project.publicKey, "outbound_click", { domain: "github.com" }))).status).toBe(204);
		expect((await rows("events", project.id))[0]).toMatchObject({ name: "outbound_click", props: '{"domain":"github.com"}' });
	});

	it.each([
		["a full URL", { domain: "https://github.com/wahab" }],
		["a domain with www.", { domain: "www.github.com" }],
		["extra props", { domain: "github.com", url: "/x" }],
		["no domain", {}],
	])("refuses an outbound click with %s", async (_label, props) => {
		const project = await keyedProject();
		expect((await send(browserEvent(project.publicKey, "outbound_click", props))).status).toBe(400);
	});

	it("records a file download with the file name and type only", async () => {
		const project = await keyedProject({ browser_events: "[]" });
		expect((await send(browserEvent(project.publicKey, "file_download", { file: "Wahab-CV.pdf", type: "pdf" }))).status).toBe(204);
		expect((await rows("events", project.id))[0]).toMatchObject({ name: "file_download", props: '{"file":"Wahab-CV.pdf","type":"pdf"}' });
	});

	it.each([
		["a path instead of a file name", { file: "/files/cv.pdf", type: "pdf" }],
		["an unknown file type", { file: "photo.heic", type: "heic" }],
		["no type", { file: "cv.pdf" }],
	])("refuses a file download with %s", async (_label, props) => {
		const project = await keyedProject();
		expect((await send(browserEvent(project.publicKey, "file_download", props))).status).toBe(400);
	});

	it("records a not-found page with its path", async () => {
		const project = await keyedProject({ browser_events: "[]" });
		await send(browserEvent(project.publicKey, "not_found", {}, { path: "/old-case-study" }));
		expect((await rows("events", project.id))[0]).toMatchObject({ name: "not_found", path: "/old-case-study", props: "{}" });
	});

	it("refuses props on not_found", async () => {
		const project = await keyedProject();
		expect((await send(browserEvent(project.publicKey, "not_found", { referrer: "x" }))).status).toBe(400);
	});

	it("records form started and form submitted", async () => {
		const project = await keyedProject({ browser_events: "[]" });
		await send(browserEvent(project.publicKey, "form_started", { form: "contact" }));
		await send(browserEvent(project.publicKey, "form_submitted", { form: "contact" }));
		const stored = await rows<{ name: string; props: string }>("events", project.id);
		expect(stored.map((row) => [row.name, row.props])).toEqual([
			["form_started", '{"form":"contact"}'],
			["form_submitted", '{"form":"contact"}'],
		]);
	});

	it.each([
		["no form name", {}],
		["a form name with spaces", { form: "Contact Form" }],
		["extra props", { form: "contact", email: "x" }],
	])("refuses a form event with %s", async (_label, props) => {
		const project = await keyedProject();
		expect((await send(browserEvent(project.publicKey, "form_started", props))).status).toBe(400);
	});
});

describe("/v1/events from a server", () => {
	it("records a server event with no visitor ID", async () => {
		const project = await keyedProject();
		const response = await handleEvent(serverRequest("/v1/events", { name: "job_posted", props: { plan: "free" } }, project.secretKey), testDeps());
		expect(response.status).toBe(204);
		expect((await rows("events", project.id))[0]).toMatchObject({ source: "server", visitor_id: null, name: "job_posted", path: null });
	});

	it("refuses a wrong secret key", async () => {
		const project = await keyedProject();
		const response = await handleEvent(serverRequest("/v1/events", { name: "job_posted" }, createSecretKey()), testDeps());
		expect(response.status).toBe(401);
		expect(await count("events", project.id)).toBe(0);
	});

	it("refuses a public key used as a secret key", async () => {
		const project = await keyedProject();
		const response = await handleEvent(serverRequest("/v1/events", { name: "job_posted" }, project.publicKey), testDeps());
		expect(response.status).toBe(401);
	});

	it("refuses a secret key sent from a browser", async () => {
		const project = await keyedProject();
		const response = await handleEvent(
			serverRequest("/v1/events", { name: "job_posted" }, project.secretKey, { Origin: "https://example.com" }),
			testDeps(),
		);
		expect(response.status).toBe(403);
		expect(await count("events", project.id)).toBe(0);
	});

	it("still checks props", async () => {
		const project = await keyedProject();
		const response = await handleEvent(serverRequest("/v1/events", { name: "job_posted", props: { by: "jo@example.com" } }, project.secretKey), testDeps());
		expect(response.status).toBe(400);
	});
});

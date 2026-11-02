import { describe, expect, it } from "vitest";
import { handleMetrics } from "@/lib/collector/metrics";
import { setProjectKeys } from "@/lib/db/projects";
import { createSecretKey, hashSecretKey, secretKeyHint } from "@/lib/keys";
import { db } from "../helpers";
import { fakeLimiter, keyedProject, NOW, serverRequest, testDeps } from "./helpers";

async function projectWithMetric() {
	const project = await keyedProject();
	await db
		.prepare("INSERT INTO metrics (project_id, key, label, source) VALUES (?1, 'returning_users', 'Returning users', 'product')")
		.bind(project.id)
		.run();
	await db.prepare("INSERT INTO metrics (project_id, key, label, source) VALUES (?1, 'visitors', 'Visitors', 'collector')").bind(project.id).run();
	return project;
}

async function storedValues(projectId: number) {
	const { results } = await db
		.prepare("SELECT m.key, v.day, v.value FROM metric_values v JOIN metrics m ON m.id = v.metric_id WHERE m.project_id = ?1 ORDER BY v.day")
		.bind(projectId)
		.all();
	return results;
}

const post = (body: unknown, key: string, deps = testDeps()) => handleMetrics(serverRequest("/v1/metrics", body, key), deps);

describe("/v1/metrics", () => {
	it("saves today's value and replaces it when sent again", async () => {
		const project = await projectWithMetric();
		expect((await post({ metrics: [{ key: "returning_users", value: 31 }] }, project.secretKey)).status).toBe(200);
		await post({ metrics: [{ key: "returning_users", value: 34 }] }, project.secretKey);
		expect(await storedValues(project.id)).toEqual([{ key: "returning_users", day: "2026-11-02", value: 34 }]);
	});

	it("accepts yesterday but not earlier or later", async () => {
		const project = await projectWithMetric();
		expect((await post({ metrics: [{ key: "returning_users", value: 20, day: "2026-11-01" }] }, project.secretKey)).status).toBe(200);
		expect((await post({ metrics: [{ key: "returning_users", value: 9, day: "2026-10-31" }] }, project.secretKey)).status).toBe(400);
		expect((await post({ metrics: [{ key: "returning_users", value: 9, day: "2026-11-03" }] }, project.secretKey)).status).toBe(400);
	});

	it("refuses a wrong secret key", async () => {
		const project = await projectWithMetric();
		expect((await post({ metrics: [{ key: "returning_users", value: 1 }] }, createSecretKey())).status).toBe(401);
		expect(await storedValues(project.id)).toEqual([]);
	});

	it("refuses a rotated-out secret key", async () => {
		const project = await projectWithMetric();
		const fresh = createSecretKey();
		await setProjectKeys(db, project.slug, { secretKeyHash: await hashSecretKey(fresh), secretKeyHint: secretKeyHint(fresh) });
		expect((await post({ metrics: [{ key: "returning_users", value: 1 }] }, project.secretKey)).status).toBe(401);
		expect((await post({ metrics: [{ key: "returning_users", value: 1 }] }, fresh)).status).toBe(200);
	});

	it("refuses the public key", async () => {
		const project = await projectWithMetric();
		expect((await post({ metrics: [{ key: "returning_users", value: 1 }] }, project.publicKey)).status).toBe(401);
	});

	it("refuses a secret key sent from a browser", async () => {
		const project = await projectWithMetric();
		const request = serverRequest("/v1/metrics", { metrics: [{ key: "returning_users", value: 1 }] }, project.secretKey, {
			Origin: "https://example.com",
		});
		expect((await handleMetrics(request, testDeps())).status).toBe(403);
	});

	it("refuses numbers that aren't the project's product numbers", async () => {
		const project = await projectWithMetric();
		const unknown = await post({ metrics: [{ key: "jobs_listed", value: 1 }] }, project.secretKey);
		expect(unknown.status).toBe(400);
		expect(await unknown.json()).toEqual({ error: expect.stringContaining("jobs_listed") });
		// Built from page views, so it can't be overwritten.
		expect((await post({ metrics: [{ key: "visitors", value: 1_000_000 }] }, project.secretKey)).status).toBe(400);
	});

	it.each([
		["no list", {}],
		["an empty list", { metrics: [] }],
		["more than 20 items", { metrics: Array.from({ length: 21 }, () => ({ key: "returning_users", value: 1 })) }],
		["a value that isn't a number", { metrics: [{ key: "returning_users", value: "31" }] }],
		["an enormous value", { metrics: [{ key: "returning_users", value: 1e16 }] }],
		["a badly written day", { metrics: [{ key: "returning_users", value: 1, day: "02/11/2026" }] }],
	])("refuses %s", async (_label, body) => {
		const project = await projectWithMetric();
		expect((await post(body, project.secretKey)).status).toBe(400);
		expect(await storedValues(project.id)).toEqual([]);
	});

	it("is rate limited", async () => {
		const project = await projectWithMetric();
		const response = await post({ metrics: [{ key: "returning_users", value: 1 }] }, project.secretKey, testDeps({ limiter: fakeLimiter(false) }));
		expect(response.status).toBe(429);
	});

	it("uses UTC days", async () => {
		const project = await projectWithMetric();
		// 00:30 on 3 November in UTC is still 2 November in many places west of London.
		await post({ metrics: [{ key: "returning_users", value: 5 }] }, project.secretKey, testDeps({ now: () => NOW + 12.5 * 3_600_000 }));
		expect(await storedValues(project.id)).toEqual([{ key: "returning_users", day: "2026-11-03", value: 5 }]);
	});
});

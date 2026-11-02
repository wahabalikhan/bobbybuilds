import { describe, expect, it } from "vitest";
import { addDays, isDay, utcDay, weekStart } from "@/lib/days";
import {
	getProjectByPublicKey,
	getProjectBySecretKeyHash,
	getProjectBySlug,
	listProjects,
	setProjectKeys,
} from "@/lib/db/projects";
import {
	createPublicKey,
	createSecretKey,
	hashSecretKey,
	PUBLIC_KEY_PATTERN,
	SECRET_KEY_PATTERN,
	secretKeyHint,
	sha256Hex,
} from "@/lib/keys";
import { createProject, db } from "./helpers";

describe("keys", () => {
	it("makes keys in the expected shape, and never the same twice", () => {
		const keys = new Set(Array.from({ length: 200 }, createSecretKey));
		expect(keys.size).toBe(200);
		for (const key of keys) expect(key).toMatch(SECRET_KEY_PATTERN);
		expect(createPublicKey()).toMatch(PUBLIC_KEY_PATTERN);
	});

	it("hashes with SHA-256", async () => {
		expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	});

	it("shows only the last four characters as a hint", () => {
		expect(secretKeyHint("sk_abcdefWXYZ")).toBe("WXYZ");
	});
});

describe("days", () => {
	it("uses UTC days", () => {
		expect(utcDay(Date.UTC(2026, 10, 2, 23, 59, 59))).toBe("2026-11-02");
		expect(utcDay(Date.UTC(2026, 10, 3, 0, 0, 0))).toBe("2026-11-03");
	});

	it("knows real dates", () => {
		expect(isDay("2026-11-02")).toBe(true);
		expect(isDay("2026-02-30")).toBe(false);
		expect(isDay("2026-1-2")).toBe(false);
	});

	it("adds days across months and finds the Monday of a week", () => {
		expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
		expect(addDays("2026-11-01", -90)).toBe("2026-08-03");
		expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday
		expect(weekStart("2026-11-02")).toBe("2026-11-02"); // Monday
	});
});

describe("project queries", () => {
	it("returns the seeded projects in order with parsed lists", async () => {
		const projects = await listProjects(db);
		const [portfolio, jobBoard] = projects.filter((p) => ["portfolio", "job-board"].includes(p.slug));
		expect(portfolio.allowedOrigins).toEqual(["https://wahabalikhan.com", "https://www.wahabalikhan.com"]);
		expect(portfolio.browserEvents).toEqual(["case_study_read", "contact_click"]);
		expect(jobBoard.status).toBe("building");
		expect(jobBoard.allowedOrigins).toEqual(["https://jobboard.wahab-ali-khan.workers.dev"]);
	});

	it("sets keys, finds the project by them, and never returns the hash", async () => {
		const id = await createProject({ slug: "keys-test" });
		const publicKey = createPublicKey();
		const secretKey = createSecretKey();
		const secretKeyHash = await hashSecretKey(secretKey);

		expect(await setProjectKeys(db, "keys-test", { publicKey, secretKeyHash, secretKeyHint: secretKeyHint(secretKey) })).toBe(true);

		const byPublic = await getProjectByPublicKey(db, publicKey);
		const bySecret = await getProjectBySecretKeyHash(db, secretKeyHash);
		expect(byPublic?.id).toBe(id);
		expect(bySecret?.id).toBe(id);
		expect(JSON.stringify(bySecret)).not.toContain(secretKeyHash);
		expect(await getProjectBySecretKeyHash(db, await hashSecretKey(createSecretKey()))).toBeNull();
	});

	it("rotates the secret key and keeps the public key", async () => {
		await createProject({ slug: "rotate-test" });
		const publicKey = createPublicKey();
		const oldSecret = createSecretKey();
		await setProjectKeys(db, "rotate-test", { publicKey, secretKeyHash: await hashSecretKey(oldSecret), secretKeyHint: secretKeyHint(oldSecret) });

		const newSecret = createSecretKey();
		await setProjectKeys(db, "rotate-test", { secretKeyHash: await hashSecretKey(newSecret), secretKeyHint: secretKeyHint(newSecret) });

		expect((await getProjectBySlug(db, "rotate-test"))?.publicKey).toBe(publicKey);
		expect(await getProjectBySecretKeyHash(db, await hashSecretKey(oldSecret))).toBeNull();
		expect((await getProjectBySecretKeyHash(db, await hashSecretKey(newSecret)))?.slug).toBe("rotate-test");
	});

	it("reports when there's no such project", async () => {
		expect(await setProjectKeys(db, "no-such-project", { secretKeyHash: "a".repeat(64), secretKeyHint: "aaaa" })).toBe(false);
		expect(await getProjectBySlug(db, "no-such-project")).toBeNull();
	});
});

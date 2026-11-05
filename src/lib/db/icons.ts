/**
 * Stored project icons (migration 0016). The icon's bytes are never selected into lists by
 * accident: listIconMeta has everything but the data; listIcons adds it, for the snapshot and the admin.
 */
import type { FoundIcon, IconKind } from "@/lib/icons/find";

/** SHA-256 of bytes, hex. */
async function hashBytes(data: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type IconMeta = { projectId: number; contentType: string | null; hash: string | null; kind: IconKind | null; sourceUrl: string | null; changedAt: number | null; checkedAt: number; lastError: string | null };
export type StoredIcon = IconMeta & { contentType: string; hash: string; data: Uint8Array };

type Row = { project_id: number; content_type: string | null; hash: string | null; kind: IconKind | null; source_url: string | null; changed_at: number | null; checked_at: number; last_error: string | null; data?: ArrayBuffer | number[] | null };
const meta = (r: Row): IconMeta => ({ projectId: r.project_id, contentType: r.content_type, hash: r.hash, kind: r.kind, sourceUrl: r.source_url, changedAt: r.changed_at, checkedAt: r.checked_at, lastError: r.last_error });

export async function getIconMeta(db: D1Database, projectId: number): Promise<IconMeta | null> {
	const row = await db.prepare("SELECT project_id, content_type, hash, kind, source_url, changed_at, checked_at, last_error FROM project_icons WHERE project_id = ?1").bind(projectId).first<Row>();
	return row ? meta(row) : null;
}

/** Every stored icon with its bytes (projects whose last check found nothing and had no icon are left out). */
export async function listIcons(db: D1Database): Promise<Map<number, StoredIcon>> {
	const { results } = await db.prepare("SELECT project_id, content_type, hash, kind, source_url, changed_at, checked_at, last_error, data FROM project_icons WHERE data IS NOT NULL").all<Row>();
	return new Map(results.map((r) => [r.project_id, { ...meta(r), contentType: r.content_type!, hash: r.hash!, data: r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : new Uint8Array(r.data ?? []) }]));
}

export type SaveResult = { status: "new" | "changed" | "same" | "none"; kind?: IconKind; sourceUrl?: string; error?: string };

/**
 * Records a check: stores the icon when it's new or different (by hash), else just the check time.
 * When nothing was found, the stored icon (if any) is kept and the error noted.
 */
export async function saveIconCheck(db: D1Database, projectId: number, found: FoundIcon | { error: string }, now: number): Promise<SaveResult> {
	const current = await getIconMeta(db, projectId);
	if ("error" in found) {
		await db
			.prepare(
				`INSERT INTO project_icons (project_id, checked_at, last_error) VALUES (?1, ?2, ?3)
				 ON CONFLICT (project_id) DO UPDATE SET checked_at = ?2, last_error = ?3`,
			)
			.bind(projectId, now, found.error.slice(0, 200))
			.run();
		return { status: "none", error: found.error };
	}
	const hash = await hashBytes(found.data);
	if (current?.hash === hash) {
		await db.prepare("UPDATE project_icons SET checked_at = ?2, last_error = NULL, kind = ?3, source_url = ?4 WHERE project_id = ?1").bind(projectId, now, found.kind, found.sourceUrl).run();
		return { status: "same", kind: found.kind, sourceUrl: found.sourceUrl };
	}
	await db
		.prepare(
			`INSERT INTO project_icons (project_id, content_type, data, hash, kind, source_url, changed_at, checked_at, last_error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, NULL)
			 ON CONFLICT (project_id) DO UPDATE SET content_type = ?2, data = ?3, hash = ?4, kind = ?5, source_url = ?6, changed_at = ?7, checked_at = ?7, last_error = NULL`,
		)
		.bind(projectId, found.contentType, found.data, hash, found.kind, found.sourceUrl, now)
		.run();
	return { status: current?.hash ? "changed" : "new", kind: found.kind, sourceUrl: found.sourceUrl };
}

/** Bytes as base64 (for the snapshot and data: URLs). */
export function toBase64(data: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
	return btoa(binary);
}

/** A data: URL for showing a stored icon in the admin (no request, always current). */
export function iconDataUrl(icon: { contentType: string; data: Uint8Array }): string {
	return `data:${icon.contentType};base64,${toBase64(icon.data)}`;
}

const EXT: Record<string, string> = { "image/svg+xml": "svg", "image/png": "png", "image/x-icon": "ico", "image/jpeg": "jpg", "image/webp": "webp" };

/** The stored icon's public URL, with its hash so a new icon gets a new URL: /i/<slug>-<hash12>.<ext>. */
export function iconPath(slug: string, icon: { contentType: string; hash: string }): string {
	return `/i/${slug}-${icon.hash.slice(0, 12)}.${EXT[icon.contentType] ?? "img"}`;
}

import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
	title: "Admin",
	robots: { index: false, follow: false },
};

// Admin pages must render per request so Next.js can apply the CSP nonce from middleware.ts.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	await connection();
	return <div className="mx-auto max-w-5xl p-8">{children}</div>;
}

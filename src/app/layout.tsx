import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { owner, site } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	metadataBase: new URL(site.url),
	title: { default: `${owner.name}: ${site.name}`, template: `%s · ${site.name}` },
	description: `${owner.firstName}'s free, honest tools, built in public from ${owner.location}.`,
	icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
	// Search engines stay out until launch (site.indexable). Also sent as X-Robots-Tag by the middleware.
	robots: site.indexable ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
	openGraph: { type: "website", siteName: site.name, locale: "en_GB" },
	twitter: { card: "summary_large_image" },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en-GB">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
		</html>
	);
}

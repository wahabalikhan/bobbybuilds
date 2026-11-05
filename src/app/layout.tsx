import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { homeTitle, owner, site } from "@/lib/site";
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
	// Page name first, then the brand: pages set only their own title (see homeTitle in src/lib/site.ts).
	title: { default: homeTitle, template: `%s · ${site.name}` },
	description: `${owner.firstName}'s free, honest tools, built in public.`,
	// The icon set is generated from brand/icon.svg (npm run build:icons). ?v=2 makes browsers and
	// phones fetch the new icons; bump it whenever the icons change.
	icons: {
		icon: [
			{ url: "/favicon.ico?v=2", sizes: "16x16 32x32 48x48" },
			{ url: "/icon.svg?v=2", type: "image/svg+xml" },
		],
		apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180" }],
	},
	manifest: "/manifest.webmanifest?v=2",
	// Search engines stay out until launch (site.indexable). Also sent as X-Robots-Tag by the middleware.
	robots: site.indexable ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
	openGraph: { type: "website", siteName: site.name, locale: "en_GB" },
	twitter: { card: "summary_large_image" },
};

/** The browser chrome around the page follows the page: white, or the dark page colour in dark mode. */
export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
	],
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

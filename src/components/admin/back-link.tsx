import Link from "next/link";

/** "‹ Journey": the one way back on the Journey sub-pages (there are no breadcrumbs; the wordmark goes Home). */
export function BackLink({ href, children }: { href: string; children: string }) {
	return (
		<Link href={href} className="link inline-block text-sm">
			<span aria-hidden>‹ </span>
			{children}
		</Link>
	);
}

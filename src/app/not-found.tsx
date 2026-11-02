import Link from "next/link";
import { buttonClass } from "@/components/admin/ui";
import { SiteHeader } from "@/components/public/site-header";

export default function NotFound() {
	return (
		<>
			<SiteHeader />
			<main id="content" className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
				<h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
				<p className="mt-2 text-ink-2">There&rsquo;s nothing at this address. It may have moved, or the project may have a new name.</p>
				<Link href="/" className={`${buttonClass} mt-6`}>
					Back to the projects
				</Link>
			</main>
		</>
	);
}

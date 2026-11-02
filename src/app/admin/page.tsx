import { site } from "@/lib/site";

// Placeholder until the private dashboard in Phase 5.
export default function AdminHome() {
	return (
		<main className="flex flex-col gap-2">
			<h1 className="text-2xl font-semibold tracking-tight">You&rsquo;re in</h1>
			<p className="opacity-80">This is the private side of {site.name}. The dashboard arrives in Phase 5.</p>
		</main>
	);
}

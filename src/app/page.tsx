import { site } from "@/lib/site";

// Placeholder until the public indie page in Phase 6.
export default function Home() {
	return (
		<main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8">
			<h1 className="text-3xl font-semibold tracking-tight">{site.name}</h1>
			<p className="text-lg opacity-80">Something&rsquo;s being built here. Check back soon.</p>
		</main>
	);
}

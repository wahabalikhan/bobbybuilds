import { redirect } from "next/navigation";
import { adminHref } from "@/lib/site";

// The old Settings list: projects are on Home now, each with its own Settings tab.
export default function OldSettings() {
	redirect(adminHref());
}

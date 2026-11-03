import { redirect } from "next/navigation";
import { adminHref } from "@/lib/site";

// The old New project address.
export default function OldNewProject() {
	redirect(adminHref("/projects/new"));
}

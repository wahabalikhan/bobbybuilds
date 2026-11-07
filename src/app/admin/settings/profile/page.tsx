import { redirect } from "next/navigation";
import { adminHref } from "@/lib/site";

// The old Public page settings: "Started building" is in the Settings card on Home now, and the
// Activity section is always shown.
export default function OldPublicPage() {
	redirect(`${adminHref()}#settings-heading`);
}

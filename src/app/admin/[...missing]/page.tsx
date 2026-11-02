import { AdminNotFoundMessage } from "@/components/admin/not-found-message";

// Any unknown /admin address: shown inside the admin layout, so the LIVE DATA banner is there too.
export default function AdminMissing() {
	return <AdminNotFoundMessage />;
}

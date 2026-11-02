import { NextResponse, type NextRequest } from "next/server";
import { site } from "@/lib/site";
import { ACCESS_JWT_HEADER, isValidAccessJwt, readAccessConfig } from "@/lib/security/access";
import { adminCsp, adminOnlyHeaders, createNonce, publicCsp, securityHeaders } from "@/lib/security/headers";

// Edge middleware (not Next 16 proxy.ts): it is what OpenNext officially supports on Cloudflare.
// Admin pages live in src/app/admin. If site.adminPath is changed, requests to the new
// path are rewritten here and the internal path is hidden.
const INTERNAL_ADMIN_PATH = "/admin";

// `next dev` only. Production builds always have NODE_ENV=production, so this can't ship.
const skipAccessInDev = process.env.NODE_ENV === "development";

function isUnder(pathname: string, base: string): boolean {
	return pathname === base || pathname.startsWith(`${base}/`);
}

function withHeaders(response: NextResponse, headers: Record<string, string>): NextResponse {
	for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
	return response;
}

function plainResponse(body: string, status: number): NextResponse {
	const response = new NextResponse(body, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
	return withHeaders(response, { ...securityHeaders, ...adminOnlyHeaders, "Content-Security-Policy": "default-src 'none'" });
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const adminMoved = site.adminPath !== INTERNAL_ADMIN_PATH;

	if (adminMoved && isUnder(pathname, INTERNAL_ADMIN_PATH)) {
		return plainResponse("Not found.", 404);
	}

	if (isUnder(pathname, site.adminPath)) {
		const token = request.headers.get(ACCESS_JWT_HEADER);
		if (!skipAccessInDev && !(await isValidAccessJwt(token, readAccessConfig()))) {
			return plainResponse("Sorry, you don't have access to this page.", 403);
		}

		const nonce = createNonce();
		const csp = adminCsp(nonce);
		// Next.js reads the nonce from the request's CSP header and stamps its own scripts.
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set("Content-Security-Policy", csp);
		requestHeaders.set("x-nonce", nonce);

		const response = adminMoved
			? NextResponse.rewrite(
					new URL(INTERNAL_ADMIN_PATH + pathname.slice(site.adminPath.length) + request.nextUrl.search, request.url),
					{ request: { headers: requestHeaders } },
				)
			: NextResponse.next({ request: { headers: requestHeaders } });

		return withHeaders(response, { ...securityHeaders, ...adminOnlyHeaders, "Content-Security-Policy": csp });
	}

	return withHeaders(NextResponse.next(), { ...securityHeaders, "Content-Security-Policy": publicCsp() });
}

export const config = {
	matcher: [
		// Everything except build assets and static files, which carry no HTML.
		"/((?!_next/static|_next/image|favicon\\.svg|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml)$).*)",
	],
};

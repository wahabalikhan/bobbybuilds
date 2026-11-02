/**
 * The time for this request. Admin pages are server components rendered once per request,
 * so reading the clock here is safe; keeping it in one place also makes it easy to fake.
 */
export function requestTime(): number {
	return Date.now();
}

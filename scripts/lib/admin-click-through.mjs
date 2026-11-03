/**
 * Clicks through the admin in real Chrome (headless, via the DevTools protocol), the way a person
 * moves around: Home → each project card → every tab → its settings → "Open dashboard". Fails on
 * "Something went wrong" or an uncaught page error. Client-side navigation is what plain fetches
 * can't check. Used by `npm run test:admin-live`; skipped (with a note) when Chrome isn't installed.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((path) => existsSync(path));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @returns {Promise<{ skipped: boolean, problems: string[], visited: number }>} */
export async function clickThrough(origin) {
	if (!CHROME) return { skipped: true, problems: [], visited: 0 };
	const profile = mkdtempSync(join(tmpdir(), "admin-click-"));
	const port = 9400 + Math.floor(Math.random() * 400);
	const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, "--no-first-run", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
	const problems = [];
	let visited = 0;
	try {
		let targets = [];
		for (let i = 0; i < 50 && !targets.length; i += 1) {
			try {
				targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === "page");
			} catch {
				await sleep(200);
			}
		}
		const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
		await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
		let id = 0;
		const pending = new Map();
		const errors = [];
		ws.addEventListener("message", (event) => {
			const message = JSON.parse(event.data);
			if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
			pending.get(message.id)?.(message);
		});
		const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
		const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
		const settle = () => sleep(1500);
		const check = async (label) => {
			visited += 1;
			const broken = await evaluate(`document.body.innerText.toLowerCase().includes("something went wrong")`);
			if (broken) problems.push(`${label} (${await evaluate("location.pathname + location.search")}) shows "Something went wrong".`);
			for (const error of errors.splice(0)) problems.push(`${label}: page error: ${String(error).split("\n")[0].slice(0, 160)}`);
		};
		const click = (selector, text) => evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((a) => ${text ? `a.textContent.trim() === ${JSON.stringify(text)}` : "true"}); if (!el) return false; el.click(); return true; })()`);

		await send("Runtime.enable");
		await send("Page.navigate", { url: `${origin}/admin` });
		await settle();
		await check("Home");
		const projects = await evaluate(`[...new Set([...document.querySelectorAll('main a[href^="/admin/projects/"]')].map((a) => a.getAttribute("href")))]`);
		for (const href of projects ?? []) {
			await send("Page.navigate", { url: `${origin}/admin` });
			await settle();
			if (!(await click(`main a[href="${href}"]`))) {
				problems.push(`Home has no card link to ${href}.`);
				continue;
			}
			await settle();
			await check(`${href} from its card`);
			const tabs = await evaluate(`[...document.querySelectorAll('nav a[href*="tab="]')].map((a) => a.textContent.trim())`);
			for (const tab of tabs ?? []) {
				await click('nav a[href*="tab="]', tab);
				await settle();
				await check(`${href}, ${tab} tab`);
			}
			await send("Page.navigate", { url: `${origin}${href.replace("/admin/projects/", "/admin/settings/projects/")}` });
			await settle();
			await check(`${href} settings`);
			if (!(await click("a", "Open dashboard"))) problems.push(`${href} settings has no "Open dashboard" link.`);
			await settle();
			await check(`${href} via "Open dashboard"`);
		}
		ws.close();
	} finally {
		// Wait for Chrome to exit (it writes to its profile as it closes), then tidy up.
		const exited = new Promise((resolve) => chrome.once("exit", resolve));
		chrome.kill();
		await Promise.race([exited, sleep(5000)]);
		try {
			rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
		} catch {
			// A leftover temp folder isn't worth failing the test over.
		}
	}
	return { skipped: false, problems, visited };
}

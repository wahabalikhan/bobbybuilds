/**
 * "Don't count my visits": one localStorage flag, per site and per browser, that only the owner
 * sets. When it's there, t.js sends nothing from that browser.
 *
 * - Set it by opening any page of the site with #bobby-ignore at the end of the address (t.js does
 *   it, and says so), or with the switch on admin Home for bobbybuilds.app itself.
 * - Clear it with #bobby-count, or the same switch.
 *
 * Shared by t.js (src/tracker/core.ts) and the admin switch, so the names can't drift apart.
 */
export const IGNORE_KEY = "bobby_ignore";
export const IGNORE_HASH = "#bobby-ignore";
export const COUNT_HASH = "#bobby-count";

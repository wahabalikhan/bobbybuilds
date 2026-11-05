#!/usr/bin/env node
/**
 * Generates every icon from the master SVGs in brand/ (run after changing them; the outputs are
 * committed, so builds don't need it):
 *   public/icon.svg              the SVG favicon (brand/icon.svg)
 *   public/favicon.ico           16, 32 and 48px (PNG-in-ICO), from brand/icon.svg
 *   public/apple-touch-icon.png  180px, solid, no transparency (brand/icon-apple.svg)
 *   public/icons/icon-192.png    192px and 512px for the web manifest (brand/icon.svg)
 *   public/icons/icon-512.png
 *   public/icons/icon-maskable-512.png  512px maskable for Android (brand/icon-maskable.svg)
 * Usage: npm run build:icons
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const INK = "#15171C";
const master = readFileSync("brand/icon.svg");
const apple = readFileSync("brand/icon-apple.svg");
const maskable = readFileSync("brand/icon-maskable.svg");

/** Renders an SVG (drawn on a 512 box) at `size` pixels, crisply, as PNG. `solid` drops the alpha channel. */
async function png(svg, size, solid = false) {
	let image = sharp(svg, { density: (72 * size) / 512 }).resize(size, size);
	if (solid) image = image.flatten({ background: INK }).removeAlpha();
	return image.png({ compressionLevel: 9 }).toBuffer();
}

/** An .ico holding PNG images (supported by every current browser), largest last. */
function ico(images) {
	const header = Buffer.alloc(6 + 16 * images.length);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);
	let offset = header.length;
	images.forEach(({ size, data }, i) => {
		const e = 6 + 16 * i;
		header.writeUInt8(size >= 256 ? 0 : size, e);
		header.writeUInt8(size >= 256 ? 0 : size, e + 1);
		header.writeUInt8(0, e + 2);
		header.writeUInt8(0, e + 3);
		header.writeUInt16LE(1, e + 4);
		header.writeUInt16LE(32, e + 6);
		header.writeUInt32LE(data.length, e + 8);
		header.writeUInt32LE(offset, e + 12);
		offset += data.length;
	});
	return Buffer.concat([header, ...images.map((i) => i.data)]);
}

mkdirSync("public/icons", { recursive: true });
copyFileSync("brand/icon.svg", "public/icon.svg");
writeFileSync("public/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(master, size) })))));
writeFileSync("public/apple-touch-icon.png", await png(apple, 180, true));
writeFileSync("public/icons/icon-192.png", await png(master, 192));
writeFileSync("public/icons/icon-512.png", await png(master, 512));
writeFileSync("public/icons/icon-maskable-512.png", await png(maskable, 512, true));
console.log("✓ build-icons: icon.svg, favicon.ico (16, 32, 48), apple-touch-icon.png (180), icons/icon-192.png, icon-512.png, icon-maskable-512.png");

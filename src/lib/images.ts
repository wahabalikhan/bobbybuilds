import { IMAGES } from "./images.generated";

export type ImageSet = { src: string; srcSet: string; width: number; height: number };

/**
 * A screenshot's WebP copies (public/screenshots/, made by npm run build:images) for an <img>'s src
 * and srcset. Takes its name ("rtj-desktop") or its full-size path ("/screenshots/rtj-desktop.webp",
 * as saved in a project's Settings). Null when there's no such image.
 */
export function imageSet(nameOrPath: string | null | undefined): ImageSet | null {
	if (!nameOrPath) return null;
	const name = nameOrPath.replace(/^\/screenshots\//, "").replace(/\.webp$/, "");
	const image = IMAGES[name];
	if (!image) return null;
	const full = image.widths.at(-1)!;
	return {
		src: `/screenshots/${name}.webp`,
		srcSet: image.widths.map((w) => `/screenshots/${name}${w === full ? "" : `-${w}`}.webp ${w}w`).join(", "),
		width: image.width,
		height: image.height,
	};
}

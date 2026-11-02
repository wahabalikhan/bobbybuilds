/** Small inline icons (decorative: always next to a text label). */
type IconProps = { className?: string };

export function LinkedInIcon({ className = "h-4 w-4" }: IconProps) {
	return (
		<svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
			<path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
		</svg>
	);
}

export function GitHubIcon({ className = "h-4 w-4" }: IconProps) {
	return (
		<svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
			<path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22v3.29c0 .31.21.69.82.57A12 12 0 0 0 12 .3Z" />
		</svg>
	);
}

export function ArrowIcon({ className = "h-3.5 w-3.5" }: IconProps) {
	return (
		<svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
			<path d="M5 11 11 5M6 5h5v5" />
		</svg>
	);
}

export function PinIcon({ className = "h-3.5 w-3.5" }: IconProps) {
	return (
		<svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
			<path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 1 0-9 0C3.5 9.8 8 14 8 14Z" />
			<circle cx="8" cy="6.5" r="1.6" />
		</svg>
	);
}

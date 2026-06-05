export function GhIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.34c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.83 1.27.83 2.15 0 3.07-1.87 3.74-3.65 3.94.29.25.55.74.55 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 8 0z" />
		</svg>
	);
}

export function ArrowIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<path
				d="M2 7h10m0 0L7.5 2.5M12 7l-4.5 4.5"
				stroke="currentColor"
				strokeWidth="1.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function CheckIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<path d="M2 7.5l3 3 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function Dot({ color }: { color: string }) {
	return <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />;
}

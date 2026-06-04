"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				minHeight: "60vh",
				gap: "1rem",
				padding: "2rem",
				textAlign: "center",
			}}
		>
			<h1 style={{ fontSize: "1.25rem", margin: 0 }}>Something went wrong</h1>
			<p style={{ opacity: 0.7 }}>The page failed to render. Reloading usually fixes it.</p>
			<button
				type="button"
				onClick={reset}
				style={{
					padding: "0.5rem 1rem",
					borderRadius: "0.5rem",
					border: "1px solid currentColor",
					background: "transparent",
					cursor: "pointer",
				}}
			>
				Try again
			</button>
		</main>
	);
}

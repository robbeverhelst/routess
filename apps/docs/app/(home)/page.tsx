import Link from "next/link";

export default function HomePage() {
	return (
		<main
			style={{
				minHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "4rem 1.5rem",
				gap: "2rem",
				textAlign: "center",
			}}
		>
			<div>
				<h1 style={{ fontSize: "3rem", fontWeight: 700, marginBottom: "1rem" }}>Routess Documentation</h1>
				<p style={{ fontSize: "1.125rem", opacity: 0.75, maxWidth: 640 }}>
					Everything you need to use, build, and deploy Routess — the open-source route planning platform.
				</p>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
					gap: "1rem",
					maxWidth: 800,
					width: "100%",
				}}
			>
				<Link
					href="/guide"
					style={{
						padding: "1.5rem",
						borderRadius: "0.75rem",
						border: "1px solid var(--color-fd-border)",
						textDecoration: "none",
						color: "inherit",
						background: "var(--color-fd-card)",
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>User Guide →</div>
					<div style={{ opacity: 0.7, fontSize: "0.9rem" }}>
						How to use Routess. Plan your first route in 3 minutes.
					</div>
				</Link>

				<Link
					href="/docs"
					style={{
						padding: "1.5rem",
						borderRadius: "0.75rem",
						border: "1px solid var(--color-fd-border)",
						textDecoration: "none",
						color: "inherit",
						background: "var(--color-fd-card)",
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Developer Docs →</div>
					<div style={{ opacity: 0.7, fontSize: "0.9rem" }}>Architecture, packages, deployment, and contributing.</div>
				</Link>

				<Link
					href="/api-reference"
					style={{
						padding: "1.5rem",
						borderRadius: "0.75rem",
						border: "1px solid var(--color-fd-border)",
						textDecoration: "none",
						color: "inherit",
						background: "var(--color-fd-card)",
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>API Reference →</div>
					<div style={{ opacity: 0.7, fontSize: "0.9rem" }}>REST endpoints, auth, and data models.</div>
				</Link>
			</div>
		</main>
	);
}

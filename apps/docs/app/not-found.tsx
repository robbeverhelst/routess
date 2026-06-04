import Link from "next/link";

export default function NotFound() {
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
			<p style={{ fontSize: "3rem", fontWeight: 700, margin: 0 }}>404</p>
			<h1 style={{ fontSize: "1.25rem", margin: 0 }}>This page doesn't exist</h1>
			<p style={{ opacity: 0.7, maxWidth: "28rem" }}>
				The link may be outdated. Try one of the sections below or use search.
			</p>
			<nav style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
				<Link href="/en/guide">User Guide</Link>
				<Link href="/docs">Developer Docs</Link>
				<Link href="/api-reference">API Reference</Link>
			</nav>
		</main>
	);
}

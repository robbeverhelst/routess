import Link from "next/link";

export default function HomePage() {
	return (
		<main className="docs-home">
			<section className="docs-home__hero">
				<div className="docs-home__copy">
					<p className="docs-home__eyebrow">routess documentation</p>
					<h1 className="docs-home__title">Plan a route. Pick the path.</h1>
					<p className="docs-home__lede">
						routess is the open-source route planner for cyclists, runners, and hikers. Use it, host it, or hook into
						it. Start wherever you are.
					</p>

					<div className="docs-home__actions">
						<Link href="/docs" className="docs-home__button docs-home__button--primary">
							Open Developer Docs
						</Link>
						<Link href="/guide" className="docs-home__button docs-home__button--secondary">
							Read the User Guide
						</Link>
					</div>
				</div>
			</section>

			<section className="docs-home__lanes" aria-label="Documentation sections">
				<Link href="/guide" className="docs-home__lane">
					<span className="docs-home__lane-kicker">For users</span>
					<h2>User Guide</h2>
					<p>Sign in, plan routes, edit waypoints, switch map styles, and troubleshoot the app.</p>
					<ul>
						<li>First route in minutes</li>
						<li>Task-focused walkthroughs</li>
						<li>Localized onboarding</li>
					</ul>
				</Link>

				<Link href="/docs" className="docs-home__lane">
					<span className="docs-home__lane-kicker">For builders</span>
					<h2>Developer Docs</h2>
					<p>Architecture, workspace packages, operations, and contribution rules for the monorepo.</p>
					<ul>
						<li>Getting started and repo layout</li>
						<li>State, auth, and deployment notes</li>
						<li>Conventions that keep releases moving</li>
					</ul>
				</Link>

				<Link href="/api-reference" className="docs-home__lane">
					<span className="docs-home__lane-kicker">For integrations</span>
					<h2>API Reference</h2>
					<p>Generated endpoint docs, auth flow details, and request and response shapes from the OpenAPI spec.</p>
					<ul>
						<li>Routes, users, auth, and health</li>
						<li>Schema-driven request docs</li>
						<li>Production and local base URLs</li>
					</ul>
				</Link>
			</section>
		</main>
	);
}

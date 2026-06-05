import { getDict } from "@/lib/content";
import { getLocale } from "@/lib/locale";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { MapStyles } from "./components/MapStyles";
import { MiniPlanner } from "./components/MiniPlanner";
import { Nav } from "./components/Nav";
import { OpenSourceTeaser } from "./components/OpenSourceTeaser";
import { PlanMarquee } from "./components/PlanMarquee";
import { Pricing } from "./components/Pricing";
import { RouteGen } from "./components/RouteGen";
import { Sharing } from "./components/Sharing";
import { SurfaceSection } from "./components/SurfaceSection";
import { TakeItOutside } from "./components/TakeItOutside";

export default async function LandingPage() {
	const locale = await getLocale();
	const dict = getDict(locale);
	// Read at request time (the page is dynamic via getLocale's headers()), so
	// the public token is injected via runtime env and never baked into the
	// image. Without it the mini planner falls back to a static preview.
	const mapboxToken = process.env.MAPBOX_PUBLIC_TOKEN;
	return (
		<>
			<Nav dict={dict} locale={locale} />
			<main>
				<Hero dict={dict} />
				<PlanMarquee dict={dict} />
				<MiniPlanner dict={dict} mapboxToken={mapboxToken} />
				<MapStyles dict={dict} />
				<SurfaceSection dict={dict} />
				<RouteGen dict={dict} />
				<Sharing dict={dict} />
				<TakeItOutside dict={dict} />
				<Pricing dict={dict} />
				<OpenSourceTeaser dict={dict} />
			</main>
			<Footer dict={dict} />
		</>
	);
}

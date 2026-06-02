import { getDict } from "@/lib/content";
import { getLocale } from "@/lib/locale";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { MiniPlanner } from "./components/MiniPlanner";
import { Modes } from "./components/Modes";
import { Nav } from "./components/Nav";
import { OpenSourceTeaser } from "./components/OpenSourceTeaser";
import { PlanMarquee } from "./components/PlanMarquee";
import { Pricing } from "./components/Pricing";
import { RouteGen } from "./components/RouteGen";
import { Sharing } from "./components/Sharing";
import { SurfaceSection } from "./components/SurfaceSection";

export default async function LandingPage() {
	const locale = await getLocale();
	const dict = getDict(locale);
	return (
		<>
			<Nav dict={dict} locale={locale} />
			<main>
				<Hero dict={dict} />
				<PlanMarquee dict={dict} />
				<MiniPlanner dict={dict} />
				<Modes dict={dict} />
				<SurfaceSection dict={dict} />
				<RouteGen dict={dict} />
				<Sharing dict={dict} />
				<Pricing dict={dict} />
				<OpenSourceTeaser dict={dict} />
			</main>
			<Footer dict={dict} />
		</>
	);
}

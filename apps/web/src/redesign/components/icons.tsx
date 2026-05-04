import {
	Activity,
	ArrowUp,
	Bell,
	Bike,
	BookOpen,
	Check,
	ChevronLeft,
	ChevronRight,
	Command,
	Compass,
	Copy,
	Download,
	Expand,
	Flag,
	Footprints,
	Globe,
	Heart,
	Layers,
	LocateFixed,
	Lock,
	Mail,
	MapPin,
	Maximize2,
	Menu,
	Minus,
	Moon,
	MoreHorizontal,
	Mountain,
	Play,
	Plus,
	RefreshCw,
	RotateCcw,
	RotateCw,
	Route,
	Save,
	Search,
	Settings,
	Share2,
	SlidersHorizontal,
	Sun,
	Target,
	Trash2,
	TrendingUp,
	Trophy,
	Upload,
	User,
	Users,
	X,
	Zap,
} from "lucide-react";

export const I = {
	route: Route,
	library: BookOpen,
	activity: Activity,
	explore: Compass,
	social: Users,
	settings: Settings,
	bell: Bell,
	moon: Moon,
	sun: Sun,
	user: User,
	trophy: Trophy,
	command: Command,
	search: Search,
	target: Target,
	locate: LocateFixed,
	undo: RotateCcw,
	redo: RotateCw,
	swap: RotateCcw,
	refresh: RefreshCw,
	sliders: SlidersHorizontal,
	layers: Layers,
	lock: Lock,
	expand: Expand,
	maximize: Maximize2,
	plus: Plus,
	minus: Minus,
	more: MoreHorizontal,
	menu: Menu,
	close: X,
	chevronL: ChevronLeft,
	chevronR: ChevronRight,
	pin: MapPin,
	heart: Heart,
	share: Share2,
	mail: Mail,
	download: Download,
	upload: Upload,
	save: Save,
	play: Play,
	flag: Flag,
	zap: Zap,
	mountain: Mountain,
	trend: TrendingUp,
	compass: Compass,
	globe: Globe,
	copy: Copy,
	trash: Trash2,
	arrowUp: ArrowUp,
	bike: Bike,
	run: Footprints,
	walk: Footprints,
	check: Check,
};

export type IconKey = keyof typeof I;

interface BrandIconProps {
	size?: number;
}

export function XBrand({ size = 16 }: BrandIconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
		</svg>
	);
}

export function FacebookBrand({ size = 16 }: BrandIconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.254.096-1.673.294-.42.197-.738.5-.95.91-.21.41-.317.97-.317 1.685v1.092h3.806l-.41 2.115-.422 1.552h-2.974v8.249a13.29 13.29 0 0 0-1.951.144Z" />
		</svg>
	);
}

export function WhatsAppBrand({ size = 16 }: BrandIconProps) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.711.307 1.265.49 1.697.628.713.227 1.362.195 1.875.118.572-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
		</svg>
	);
}

export function RoutessMark({ size = 22 }: { size?: number }) {
	// A simple looped-route mark — hand-drawn to match the mockup's spirit.
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M5 18 C 5 14 9 14 9 11 C 9 8 5 8 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
			<path
				d="M19 19 C 19 15 15 15 15 12 C 15 9 19 9 19 6"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
			/>
			<circle cx="5" cy="5" r="1.6" fill="currentColor" />
			<circle cx="19" cy="19" r="1.6" fill="currentColor" />
		</svg>
	);
}

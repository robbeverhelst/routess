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
	X,
	Zap,
} from "lucide-react";

export const I = {
	route: Route,
	library: BookOpen,
	activity: Activity,
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

import { useEffect, useState } from "react";

export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

export interface Viewport {
	isMobile: boolean;
	isTablet: boolean;
	isDesktop: boolean;
	width: number;
}

function read(): Viewport {
	if (typeof window === "undefined") {
		return { isMobile: false, isTablet: false, isDesktop: true, width: 1280 };
	}
	const width = window.innerWidth;
	return {
		isMobile: width < MOBILE_BREAKPOINT,
		isTablet: width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT,
		isDesktop: width >= TABLET_BREAKPOINT,
		width,
	};
}

export function useViewport(): Viewport {
	const [vp, setVp] = useState<Viewport>(read);

	useEffect(() => {
		let frame: number | null = null;
		const onResize = () => {
			if (frame !== null) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				setVp(read());
				frame = null;
			});
		};
		window.addEventListener("resize", onResize);
		window.addEventListener("orientationchange", onResize);
		return () => {
			if (frame !== null) cancelAnimationFrame(frame);
			window.removeEventListener("resize", onResize);
			window.removeEventListener("orientationchange", onResize);
		};
	}, []);

	return vp;
}

export function useIsMobile(): boolean {
	return useViewport().isMobile;
}

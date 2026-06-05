"use client";

import { useEffect } from "react";

// Wires the .reveal scroll animations. Sets data-anim-ready on <html> (the CSS
// hidden state is gated on it, so content stays visible without JS), then
// reveals elements as they enter the viewport.
export function AnimationRoot() {
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		document.documentElement.setAttribute("data-anim-ready", "");
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.classList.add("in");
						observer.unobserve(entry.target);
					}
				}
			},
			{ rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
		);
		for (const el of document.querySelectorAll(".reveal")) {
			observer.observe(el);
		}
		return () => {
			observer.disconnect();
			document.documentElement.removeAttribute("data-anim-ready");
		};
	}, []);
	return null;
}

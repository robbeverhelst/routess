"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { haversineDistance } from "@routess/core";
import { landingAccents } from "@routess/design-tokens";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/content";
import {
	encodeShareRoute,
	type LngLat,
	MINI_PLANNER_CENTER,
	MINI_PLANNER_START,
	MINI_PLANNER_ZOOM,
} from "@/lib/demo-routes";
import { APP_HOST } from "@/lib/i18n";
import { AccentInline } from "./AccentText";
import { ArrowIcon, Dot } from "./Icons";

type MapboxMap = import("mapbox-gl").Map;

// Mirrors the app's light map palette (apps/web/src/features/routing/managers/mapPalette.ts).
const PALETTE = {
	routeMain: "rgb(102, 56, 207)",
	routeCasing: "rgba(0, 0, 0, 0.18)",
	waypointStart: "rgb(63, 154, 90)",
	waypointEnd: "rgb(204, 91, 56)",
	waypointInter: "rgb(102, 56, 207)",
	waypointStroke: "rgb(255, 255, 255)",
};

type Mode = keyof Dict["planner"]["modes"];

const PROFILE_BY_MODE: Record<Mode, "walking" | "cycling"> = {
	run: "walking",
	cycle: "cycling",
	walk: "walking",
};

// km/h used for the time estimate, mirroring the app's per-activity pacing.
const SPEED_BY_MODE: Record<Mode, number> = { run: 10, cycle: 18, walk: 4.8 };

interface RouteResult {
	geometry: LngLat[];
	distanceKm: number;
	// Waypoints snapped onto the road network by Directions, so pins sit on
	// the route instead of floating where the user clicked.
	snapped: LngLat[] | null;
}

async function fetchRoute(waypoints: LngLat[], mode: Mode, token: string | undefined): Promise<RouteResult> {
	const fallback: RouteResult = {
		geometry: waypoints,
		distanceKm: waypoints.slice(1).reduce((sum, wp, i) => sum + haversineDistance(waypoints[i] as LngLat, wp), 0),
		snapped: null,
	};
	if (!token || waypoints.length < 2) return fallback;
	try {
		const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
		const res = await fetch(
			`https://api.mapbox.com/directions/v5/mapbox/${PROFILE_BY_MODE[mode]}/${coords}?geometries=geojson&overview=full&access_token=${token}`,
		);
		if (!res.ok) return fallback;
		const data = (await res.json()) as {
			routes?: { geometry: { coordinates: LngLat[] }; distance: number }[];
			waypoints?: { location: LngLat }[];
		};
		const route = data.routes?.[0];
		if (!route) return fallback;
		return {
			geometry: route.geometry.coordinates,
			distanceKm: route.distance / 1000,
			snapped: data.waypoints?.map((w) => w.location) ?? null,
		};
	} catch {
		return fallback;
	}
}

function lineFeature(coordinates: LngLat[]) {
	return {
		type: "FeatureCollection" as const,
		features:
			coordinates.length < 2
				? []
				: [
						{
							type: "Feature" as const,
							properties: {},
							geometry: { type: "LineString" as const, coordinates },
						},
					],
	};
}

function waypointFeatures(waypoints: LngLat[]) {
	return {
		type: "FeatureCollection" as const,
		features: waypoints.map((coord, i) => ({
			type: "Feature" as const,
			properties: {
				color:
					i === 0 ? PALETTE.waypointStart : i === waypoints.length - 1 ? PALETTE.waypointEnd : PALETTE.waypointInter,
			},
			geometry: { type: "Point" as const, coordinates: coord },
		})),
	};
}

// Odometer-style tick toward a new value; jumps instantly under reduced motion.
function useAnimatedNumber(value: number): number {
	const [display, setDisplay] = useState(value);
	const fromRef = useRef(value);
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			fromRef.current = value;
			setDisplay(value);
			return;
		}
		const from = fromRef.current;
		const start = performance.now();
		const duration = 450;
		let raf = 0;
		const step = (now: number) => {
			const p = Math.min(1, (now - start) / duration);
			const eased = 1 - (1 - p) ** 3;
			setDisplay(from + (value - from) * eased);
			if (p < 1) {
				raf = requestAnimationFrame(step);
			} else {
				fromRef.current = value;
			}
		};
		raf = requestAnimationFrame(step);
		return () => {
			cancelAnimationFrame(raf);
			fromRef.current = value;
		};
	}, [value]);
	return display;
}

function formatTime(distanceKm: number, mode: Mode): string {
	const minutes = (distanceKm / SPEED_BY_MODE[mode]) * 60;
	if (minutes < 60) return `${Math.round(minutes)} min`;
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return `${h}:${m.toString().padStart(2, "0")} h`;
}

export function MiniPlanner({ dict, mapboxToken }: { dict: Dict; mapboxToken?: string }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapboxMap | null>(null);
	const [mapReady, setMapReady] = useState(false);
	const [waypoints, setWaypoints] = useState<LngLat[]>(MINI_PLANNER_START);
	const [mode, setMode] = useState<Mode>("cycle");
	const [route, setRoute] = useState<RouteResult>({ geometry: [], distanceKm: 0, snapped: null });
	const [shareHref, setShareHref] = useState(`https://${APP_HOST}/`);

	// Lazy-init the map the first time the section scrolls into view.
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !mapboxToken) return;
		let cancelled = false;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting) || mapRef.current) return;
				observer.disconnect();
				import("mapbox-gl").then(({ default: mapboxgl }) => {
					if (cancelled || mapRef.current) return;
					mapboxgl.accessToken = mapboxToken;
					const map = new mapboxgl.Map({
						container,
						style: "mapbox://styles/mapbox/standard",
						center: MINI_PLANNER_CENTER,
						zoom: MINI_PLANNER_ZOOM,
						// No scroll-zoom: hovering the demo must not trap page scrolling.
						scrollZoom: false,
						attributionControl: false,
					});
					mapRef.current = map;
					map.on("load", () => {
						// Same source/layer recipe as the app's MapLayerManager:
						// casing 5px under a 2.5px accent line, round joins.
						map.addSource("demo-route", { type: "geojson", data: lineFeature([]) });
						map.addSource("demo-waypoints", { type: "geojson", data: waypointFeatures([]) });
						map.addLayer({
							id: "demo-route-casing",
							type: "line",
							source: "demo-route",
							layout: { "line-join": "round", "line-cap": "round" },
							paint: { "line-color": PALETTE.routeCasing, "line-width": 5 },
						});
						map.addLayer({
							id: "demo-route-main",
							type: "line",
							source: "demo-route",
							layout: { "line-join": "round", "line-cap": "round" },
							paint: { "line-color": PALETTE.routeMain, "line-width": 2.5, "line-emissive-strength": 1 },
						});
						map.addLayer({
							id: "demo-waypoints",
							type: "circle",
							source: "demo-waypoints",
							paint: {
								"circle-radius": 6.5,
								"circle-color": ["get", "color"],
								"circle-stroke-color": PALETTE.waypointStroke,
								"circle-stroke-width": 2,
								"circle-emissive-strength": 1,
							},
						});
						setMapReady(true);
					});
					map.on("click", (e) => {
						setWaypoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat] as LngLat]);
					});
				});
			},
			{ rootMargin: "200px" },
		);
		observer.observe(container);
		return () => {
			cancelled = true;
			observer.disconnect();
			mapRef.current?.remove();
			mapRef.current = null;
		};
	}, [mapboxToken]);

	// Re-route whenever pins or mode change.
	useEffect(() => {
		let stale = false;
		fetchRoute(waypoints, mode, mapboxToken).then((result) => {
			if (!stale) setRoute(result);
		});
		return () => {
			stale = true;
		};
	}, [waypoints, mode, mapboxToken]);

	// Push route + pins into the map sources.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !mapReady) return;
		const routeSource = map.getSource("demo-route") as { setData: (d: unknown) => void } | undefined;
		const pinSource = map.getSource("demo-waypoints") as { setData: (d: unknown) => void } | undefined;
		routeSource?.setData(lineFeature(route.geometry));
		// Use snapped positions when they match the pin count; raw clicks
		// otherwise (e.g. a just-added pin while routing is in flight).
		const pins = route.snapped && route.snapped.length === waypoints.length ? route.snapped : waypoints;
		pinSource?.setData(waypointFeatures(pins));
	}, [route, waypoints, mapReady]);

	// "Open in app" uses the app's real share-link wire format.
	useEffect(() => {
		let stale = false;
		encodeShareRoute(waypoints).then((encoded) => {
			if (stale) return;
			setShareHref(encoded ? `https://${APP_HOST}/?route=${encoded}` : `https://${APP_HOST}/`);
		});
		return () => {
			stale = true;
		};
	}, [waypoints]);

	// Reset clears the canvas completely; the demo pins only seed the first view.
	const reset = useCallback(() => setWaypoints([]), []);

	// Both stats tick from the same animated km value, so they stay in sync.
	const animatedKm = useAnimatedNumber(route.distanceKm);
	const distance = animatedKm.toFixed(1);
	const time = formatTime(animatedKm, mode);

	return (
		<section id="planner" style={{ background: "var(--paper-2)" }}>
			<div className="container-x">
				<div className="section-header reveal">
					<span className="eyebrow">{dict.planner.eyebrow}</span>
					<h2 className="display">
						<AccentInline pieces={dict.planner.title} />
					</h2>
					<p className="body-lg">{dict.planner.body}</p>
				</div>

				<div className="grid-planner" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
					<div className="card" style={{ overflow: "hidden", padding: 0, position: "relative" }}>
						{mapboxToken ? (
							<div ref={containerRef} style={{ width: "100%", height: 420, cursor: "crosshair" }} />
						) : (
							// No token at build time: fall back to a baked static-tile
							// preview of the same demo route.
							<Image
								src="/previews/mini-planner-fallback.png"
								alt=""
								width={1280}
								height={840}
								sizes="(max-width: 900px) 100vw, 640px"
								style={{ width: "100%", height: 420, objectFit: "cover", display: "block" }}
							/>
						)}
						<div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 8 }}>
							<button
								type="button"
								className="chip"
								onClick={reset}
								style={{ cursor: "pointer", background: "white", border: "1px solid var(--line)" }}
							>
								↻ {dict.planner.reset}
							</button>
							<span className="chip" style={{ background: "white" }}>
								{waypoints.length} {dict.planner.waypoints}
							</span>
						</div>
						{mapboxToken && (
							<div style={{ position: "absolute", right: 16, top: 16 }}>
								<span className="chip" style={{ background: "white" }}>
									<Dot color="var(--indigo)" /> {dict.planner.clickHint}
								</span>
							</div>
						)}
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						<div className="card card-pad">
							<div className="eyebrow" style={{ marginBottom: 10 }}>
								{dict.planner.mode}
							</div>
							{/* Pill tabs styled like the app's activity switcher. */}
							<div style={{ display: "flex", gap: 6 }}>
								{(["run", "cycle", "walk"] as const).map((m) => (
									<button
										key={m}
										type="button"
										onClick={() => setMode(m)}
										style={{
											flex: 1,
											height: 32,
											borderRadius: 999,
											cursor: "pointer",
											fontSize: 13,
											fontWeight: 600,
											border: mode === m ? `1px solid ${landingAccents.indigoActive}` : "1px solid var(--line)",
											background: mode === m ? landingAccents.indigoActiveSoft : "var(--paper)",
											color: mode === m ? landingAccents.indigoActive : "var(--ink-soft)",
											transition: "all 120ms",
										}}
									>
										{dict.planner.modes[m]}
									</button>
								))}
							</div>
						</div>

						{/* Stats card mirroring the app's floating route chip. */}
						<div className="card card-pad">
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
								<span
									style={{
										fontSize: 11,
										color: "var(--muted-color)",
										fontFamily: "var(--font-mono)",
										letterSpacing: "0.08em",
										textTransform: "uppercase",
									}}
								>
									{dict.planner.total}
								</span>
								<span style={{ fontSize: 11, color: "var(--muted-color)", fontFamily: "var(--font-mono)" }}>
									{dict.planner.computedLive}
								</span>
							</div>
							<div style={{ display: "flex", gap: 26, marginTop: 12 }}>
								{[
									{ label: "km", value: distance },
									{ label: dict.planner.timeLabel, value: time },
								].map((stat) => (
									<div key={stat.label}>
										<div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -0.5 }}>
											{stat.value}
										</div>
										<div
											style={{
												fontSize: 11,
												color: "var(--muted-color)",
												fontFamily: "var(--font-mono)",
												textTransform: "uppercase",
												letterSpacing: "0.08em",
												marginTop: 2,
											}}
										>
											{stat.label}
										</div>
									</div>
								))}
							</div>
							<a
								className="btn"
								href={shareHref}
								style={{
									width: "100%",
									marginTop: 18,
									background: "var(--indigo)",
									color: "white",
									height: 44,
									justifyContent: "center",
								}}
							>
								{dict.planner.openInApp} <ArrowIcon />
							</a>
						</div>

						<div
							style={{ fontSize: 12, color: "var(--muted-color)", fontFamily: "var(--font-mono)", textAlign: "center" }}
						>
							{dict.planner.hint}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

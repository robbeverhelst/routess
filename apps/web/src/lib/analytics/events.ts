// Canonical ProductEvent taxonomy. The discriminated union below is the
// source of truth for event names and properties; see docs/agents/product-events.md
// for the rationale and ADRs 0019/0020 for the architectural decisions.
//
// Naming convention: <object>_<verb_past> in snake_case. Properties are
// snake_case. Adding an event: extend the union and add a row to the doc.

import type { RouteActivity, RouteVisibility } from "@routess/core";

type EmptyProps = Record<string, never>;

export type AuthProvider = "google" | "email";
export type CreationSource = "manual" | "generated" | "imported";
export type RouteType = "loop" | "a-to-b";
export type SurfaceType = "paved" | "mixed" | "unpaved";
export type LoopDirection = "clockwise" | "counter-clockwise";

export type ProductEvent =
	// Auth / signup funnel
	| { name: "user_registered"; properties: { provider: AuthProvider } }
	| { name: "user_logged_in"; properties: { provider: AuthProvider } }
	| { name: "user_logged_out"; properties: EmptyProps }
	| { name: "auth_wall_hit"; properties: { action_attempted: string } }
	| { name: "signup_started"; properties: { entry_point: string } }

	// Route lifecycle
	| {
			name: "route_created";
			properties: {
				waypoint_count: number;
				distance_m: number;
				elevation_gain_m: number;
				has_description: boolean;
				activity: RouteActivity | null;
				visibility: RouteVisibility;
				tag_count: number;
				is_first_route: boolean;
				creation_source: CreationSource;
			};
	  }
	| { name: "route_updated"; properties: { changed: string[] } }
	| { name: "route_deleted"; properties: EmptyProps }
	| { name: "route_loaded_into_editor"; properties: { creation_source: CreationSource | "unknown" } }

	// Import / export / share
	| {
			name: "gpx_imported";
			properties: {
				waypoint_count: number;
				distance_m: number;
				had_names: boolean;
				source: "file_upload" | "drag_drop" | "url";
				target: "draft" | "library";
			};
	  }
	| {
			name: "gpx_exported";
			properties: { waypoint_count: number; distance_m: number; route_was_saved: boolean };
	  }
	| {
			name: "route_share_link_copied";
			properties: { route_was_saved: boolean; url_length_bucket: "short" | "medium" | "long" };
	  }
	| { name: "route_share_link_opened"; properties: EmptyProps }

	// Route generation (feature pending, see #136)
	| {
			name: "route_generation_started";
			properties: {
				activity: RouteActivity;
				route_type: RouteType;
				target_distance_m_bucket: string;
				surface_type: SurfaceType;
				loop_direction?: LoopDirection;
			};
	  }
	| {
			name: "route_generation_succeeded";
			properties: {
				activity: RouteActivity;
				route_type: RouteType;
				candidate_count: number;
				duration_ms_bucket: string;
				delta_from_target_pct_bucket: string;
			};
	  }
	| {
			name: "route_generation_failed";
			properties: {
				activity: RouteActivity;
				route_type: RouteType;
				failure_reason: "no_route_found" | "timeout" | "provider_error" | "invalid_input";
			};
	  }

	// Library
	| { name: "library_searched"; properties: { query_length_bucket: string; result_count_bucket: string } }
	| { name: "library_filtered"; properties: { filter_type: string; result_count_bucket: string } }
	| { name: "route_favourited"; properties: { favourite: boolean } }

	// Collections
	| { name: "collection_created"; properties: { visibility: RouteVisibility } }
	| { name: "collection_deleted"; properties: EmptyProps }
	| { name: "collection_share_link_copied"; properties: { visibility: RouteVisibility } }

	// Discover
	| { name: "discover_opened"; properties: EmptyProps }
	| { name: "discover_filtered"; properties: { filter_type: "activity" | "distance" } }
	| {
			name: "discover_route_opened";
			properties: { activity: RouteActivity | null; has_place: boolean; result_count_bucket: string };
	  }

	// Social (issue #245)
	| { name: "profile_followed"; properties: { source: "profile" | "search" | "public_route" | "feed" } }
	| { name: "profile_unfollowed"; properties: EmptyProps }
	| { name: "route_share_sent"; properties: { has_message: boolean; visibility: RouteVisibility } }
	| { name: "route_share_copied"; properties: EmptyProps }
	| { name: "profile_handle_changed"; properties: EmptyProps }

	// Payment (feature pending, see #135)
	| { name: "payment_started"; properties: { plan: string; interval: "monthly" | "yearly" } }
	| { name: "payment_completed"; properties: { plan: string; interval: "monthly" | "yearly" } }
	| { name: "payment_cancelled"; properties: { plan: string; interval: "monthly" | "yearly" } }

	// Onboarding (feature pending)
	| { name: "onboarding_step_completed"; properties: { step_number: number; step_name: string } }
	| { name: "onboarding_skipped"; properties: { step_number: number; step_name: string } }
	| { name: "onboarding_completed"; properties: EmptyProps };

export type ProductEventName = ProductEvent["name"];

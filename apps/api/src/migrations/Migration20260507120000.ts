import { Migration } from "@mikro-orm/migrations";

// Collapses the three Waypoint shapes (core, api-client, api) into one canonical
// shape: { coord: [lng, lat], type, name?, timestamp? }. This migration rewrites
// the JSONB waypoints column on existing routes from { lat, lng, type?, ... } to
// the canonical form, and back on `down`.
export class Migration20260507120000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			update "route"
			set "waypoints" = coalesce((
				select jsonb_agg(
					jsonb_strip_nulls(jsonb_build_object(
						'coord', jsonb_build_array((elem->>'lng')::float, (elem->>'lat')::float),
						'type', coalesce(elem->>'type', 'routed'),
						'name', elem->>'name',
						'timestamp', elem->>'timestamp'
					))
				)
				from jsonb_array_elements("waypoints") as elem
			), '[]'::jsonb)
			where "waypoints" is not null;
		`);
	}

	override async down(): Promise<void> {
		this.addSql(`
			update "route"
			set "waypoints" = coalesce((
				select jsonb_agg(
					jsonb_strip_nulls(jsonb_build_object(
						'lng', (elem->'coord'->>0)::float,
						'lat', (elem->'coord'->>1)::float,
						'type', elem->>'type',
						'name', elem->>'name',
						'timestamp', elem->>'timestamp'
					))
				)
				from jsonb_array_elements("waypoints") as elem
			), '[]'::jsonb)
			where "waypoints" is not null;
		`);
	}
}

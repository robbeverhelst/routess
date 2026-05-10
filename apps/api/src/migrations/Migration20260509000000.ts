import { Migration } from "@mikro-orm/migrations";

// Drop dead UserPreferences keys (publicProfile, hidePrivacy, locationPermission)
// and add defaultRouteVisibility (default 'private') for issue #134.
// publicProfile was a never-wired toggle, hidePrivacy was a client-side share-link
// edge-trim that we are no longer offering, locationPermission was a per-device
// browser permission that should not have been syncing across devices.
export class Migration20260509000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`
			update "user"
			set "preferences" = (
				("preferences" - 'publicProfile' - 'hidePrivacy' - 'locationPermission')
				|| jsonb_build_object('defaultRouteVisibility', 'private')
			)
			where "preferences" is not null
				and not ("preferences" ? 'defaultRouteVisibility');
		`);
		this.addSql(`
			update "user"
			set "preferences" = (
				"preferences" - 'publicProfile' - 'hidePrivacy' - 'locationPermission'
			)
			where "preferences" is not null
				and ("preferences" ? 'defaultRouteVisibility');
		`);
	}

	override async down(): Promise<void> {
		this.addSql(`
			update "user"
			set "preferences" = (
				("preferences" - 'defaultRouteVisibility')
				|| jsonb_build_object(
					'publicProfile', false,
					'hidePrivacy', true,
					'locationPermission', 'unknown'
				)
			)
			where "preferences" is not null;
		`);
	}
}

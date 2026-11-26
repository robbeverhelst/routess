import { OmitType, PartialType } from "@nestjs/swagger";

import { CreateRouteDto } from "./create-route.dto";

// Provenance is immutable after creation (see ADR-0023). Routes that need to
// switch provenance — e.g. recalculating a legacy Mapbox route with new prefs —
// must fork into a new Route rather than mutate the existing one. Fork
// lineage is part of how the Route came to exist, so it is fixed too.
export class UpdateRouteDto extends PartialType(
	OmitType(CreateRouteDto, ["provenance", "forkedFromExternalRouteId"] as const),
) {}

import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsIn } from "class-validator";
import { Type } from "class-transformer";

class WaypointDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsString()
  @IsIn(["routed", "direct"])
  type!: "routed" | "direct";
}

export class CreateRouteDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  waypoints!: WaypointDto[];

  @IsOptional()
  @IsNumber()
  distance?: number;
}

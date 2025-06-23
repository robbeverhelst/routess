import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsIn,
  IsNotEmpty,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

class WaypointDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsString()
  @IsIn(["routed", "direct"])
  type!: "routed" | "direct";
}

export class CreateRouteDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WaypointDto)
  waypoints!: WaypointDto[];

  @IsOptional()
  @IsNumber()
  distance?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  elevationGain?: number;

  @IsOptional()
  @IsString()
  startAddress?: string;

  @IsOptional()
  @IsString()
  endAddress?: string;
}

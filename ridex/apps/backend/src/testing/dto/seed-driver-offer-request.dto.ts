import { Type } from "class-transformer";
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from "class-validator";

export class SeedLatLngDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class SeedDriverOfferRequestDto {
  @IsOptional()
  @IsIn(["prepare", "dispatch-offer"])
  mode?: "prepare" | "dispatch-offer";

  @IsOptional()
  @IsString()
  @MaxLength(64)
  testRunId?: string;

  @ValidateNested()
  @Type(() => SeedLatLngDto)
  pickup!: SeedLatLngDto;

  @ValidateNested()
  @Type(() => SeedLatLngDto)
  destination!: SeedLatLngDto;
}

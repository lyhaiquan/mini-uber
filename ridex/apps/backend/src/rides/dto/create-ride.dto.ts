import { Type } from "class-transformer";
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class GeoPointDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  address!: string;
}

export class CreateRideDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  pickup!: GeoPointDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  destination!: GeoPointDto;
}

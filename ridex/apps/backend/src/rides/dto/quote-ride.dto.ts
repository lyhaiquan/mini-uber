import { Type } from "class-transformer";
import { IsDefined, IsNumber, Max, Min, ValidateNested } from "class-validator";

export class QuoteCoordinateDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class QuoteRideDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => QuoteCoordinateDto)
  pickup!: QuoteCoordinateDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => QuoteCoordinateDto)
  destination!: QuoteCoordinateDto;
}

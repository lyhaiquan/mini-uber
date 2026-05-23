import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class OfferActionDto {
  @IsUUID()
  offerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}


import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

import { RideStatus } from "../enums/ride-status.enum";

export class TransitionRideDto {
  @IsEnum(RideStatus)
  toStatus!: RideStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}

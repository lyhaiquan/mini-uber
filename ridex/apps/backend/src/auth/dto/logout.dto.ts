import { IsString, MaxLength, MinLength } from "class-validator";

export class LogoutDto {
  @IsString()
  @MinLength(64)
  @MaxLength(256)
  refreshToken!: string;
}

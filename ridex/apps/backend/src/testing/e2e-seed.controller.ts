import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";

import { Public } from "../common/decorators/public.decorator";
import type { SeedDriverOfferResponseDto } from "./dto/seed-driver-offer-response.dto";
import { SeedDriverOfferRequestDto } from "./dto/seed-driver-offer-request.dto";
import { E2ESeedService } from "./e2e-seed.service";

@Controller("testing")
export class E2ESeedController {
  constructor(private readonly seedService: E2ESeedService) {}

  @Public()
  @Post("seed-driver-offer")
  @HttpCode(HttpStatus.CREATED)
  async seedDriverOffer(
    @Body() body: SeedDriverOfferRequestDto
  ): Promise<SeedDriverOfferResponseDto> {
    return this.seedService.seedDriverOffer(body);
  }
}

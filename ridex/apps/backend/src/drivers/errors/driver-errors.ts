import { ForbiddenException } from "@nestjs/common";

export class DriverNotEligibleError extends ForbiddenException {
  constructor() {
    super({
      code: "DRIVER_NOT_ELIGIBLE",
      message: "User is not eligible to act as a driver."
    });
  }
}


import { ConflictException } from "@nestjs/common";

export class RideAlreadyActiveError extends ConflictException {
  constructor() {
    super({
      code: "RIDE_ALREADY_ACTIVE",
      message: "Bạn đang có chuyến đi đang diễn ra."
    });
  }
}

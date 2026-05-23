import { BadRequestException, type ArgumentMetadata } from "@nestjs/common";
import { IsString } from "class-validator";

import { createGlobalValidationPipe } from "./validation-pipe.factory";

class SampleDto {
  @IsString()
  name!: string;
}

const metadata: ArgumentMetadata = {
  type: "body",
  metatype: SampleDto,
  data: undefined
};

describe("createGlobalValidationPipe", () => {
  it("accepts a valid DTO payload", async () => {
    const pipe = createGlobalValidationPipe();

    await expect(pipe.transform({ name: "RideX" }, metadata)).resolves.toBeInstanceOf(
      SampleDto
    );
  });

  it("rejects unknown fields", async () => {
    const pipe = createGlobalValidationPipe();

    await expectValidationError(pipe.transform({ name: "RideX", role: "ADMIN" }, metadata), [
      "property role should not exist"
    ]);
  });

  it("rejects invalid field types", async () => {
    const pipe = createGlobalValidationPipe();

    await expectValidationError(pipe.transform({ name: 42 }, metadata), [
      "name must be a string"
    ]);
  });
});

async function expectValidationError(
  promise: Promise<unknown>,
  expectedMessages: string[]
): Promise<void> {
  try {
    await promise;
    throw new Error("Expected validation to fail");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(BadRequestException);

    if (!(error instanceof BadRequestException)) {
      throw error;
    }

    expect(error.getResponse()).toMatchObject({
      message: expect.arrayContaining(expectedMessages)
    });
  }
}

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";


import { Injectable } from "@nestjs/common";

const TOKEN_SECRET_BYTES = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_SECRET_PATTERN = /^[0-9a-f]{64}$/i;

export interface ParsedRefreshToken {
  tokenId: string;
  secret: string;
}

export interface GeneratedRefreshToken {
  token: string;
  tokenId: string;
  secret: string;
}

@Injectable()
export class CryptoService {
  generateRefreshToken(): GeneratedRefreshToken {
    const tokenId = randomUUID();
    const secret = randomBytes(TOKEN_SECRET_BYTES).toString("hex");

    return {
      token: `${tokenId}.${secret}`,
      tokenId,
      secret
    };
  }

  parseRefreshToken(value: unknown): ParsedRefreshToken | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const parts = value.split(".");

    if (parts.length !== 2) {
      return undefined;
    }

    const [tokenId, secret] = parts;

    if (!UUID_PATTERN.test(tokenId) || !TOKEN_SECRET_PATTERN.test(secret)) {
      return undefined;
    }

    return { tokenId: tokenId.toLowerCase(), secret: secret.toLowerCase() };
  }

  hashRefreshSecret(secret: string): string {
    return createHash("sha256").update(secret, "hex").digest("hex");
  }

  constantTimeEquals(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, "hex");
    const bufferB = Buffer.from(b, "hex");

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
  }
}

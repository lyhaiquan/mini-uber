"use client";

import { ApiAuthError, ApiClientError, errorCode, errorMessage } from "@ridex/api-client";

export function apiErrorToMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return errorMessage(error.body) ?? "YÃªu cáº§u tháº¥t báº¡i";
  }
  if (error instanceof ApiAuthError) {
    return "PhiÃªn Ä‘Äƒng nháº­p háº¿t háº¡n";
  }
  return "Lá»—i káº¿t ná»‘i, vui lÃ²ng thá»­ láº¡i";
}

export function showApiError(error: unknown): void {
  const message = apiErrorToMessage(error);

  if (error instanceof ApiClientError) {
    const code = errorCode(error.body);
    console.error(code === undefined ? message : `${message} (MÃ£: ${code})`);
    return;
  }

  console.error(message);
}

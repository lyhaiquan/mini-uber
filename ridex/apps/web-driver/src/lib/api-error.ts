"use client";

import { ApiAuthError, ApiClientError, errorCode, errorMessage } from "@ridex/api-client";
import { toast } from "@ridex/ui-web";

export function apiErrorToMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return errorMessage(error.body) ?? "Yêu cầu thất bại";
  }
  if (error instanceof ApiAuthError) {
    return "Phiên đăng nhập hết hạn";
  }
  return "Lỗi kết nối, vui lòng thử lại";
}

export function showApiError(error: unknown): void {
  if (error instanceof ApiClientError) {
    const code = errorCode(error.body);
    toast.error(apiErrorToMessage(error), {
      description: code === undefined ? undefined : `Mã: ${code}`
    });
    return;
  }
  toast.error(apiErrorToMessage(error));
}

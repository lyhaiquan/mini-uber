export interface ApiMeta {
  requestId: string;
}

export interface ApiSuccessResponse<TData> {
  data: TData;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  meta: ApiMeta;
}

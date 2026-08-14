export type ApiError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type ApiResponse<T> = { data: T } | { error: ApiError }

export type ApiResult<T> = { data: T } | { error: ApiError }

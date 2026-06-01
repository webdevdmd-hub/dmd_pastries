export type ApiSuccess<TData> = {
  success: true;
  message: string;
  data: TData;
};

export type ApiFailure = {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  errorDetails?: Record<string, unknown>;
};

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export type FieldErrorMap = Record<string, string[]>;

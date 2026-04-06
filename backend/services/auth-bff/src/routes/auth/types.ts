export type AuthFallback =
  | "login_with_password"
  | "login_with_google"
  | "send_magic_link"
  | "resend_verification"
  | "reset_password";

export interface AuthErrorResponse {
  ok: false;
  code: string;
  message: string;
  fallback?: AuthFallback[];
}

export interface AuthSuccessResponse<T = unknown> {
  ok: true;
  data?: T;
  next?: string;
}

export type AuthResponse<T = unknown> = AuthSuccessResponse<T> | AuthErrorResponse;

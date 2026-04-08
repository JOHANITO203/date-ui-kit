export type AuthFallback =
  | 'login_with_password'
  | 'login_with_google'
  | 'send_magic_link'
  | 'resend_verification'
  | 'reset_password';

export type AuthErrorResponse = {
  ok: false;
  code: string;
  message: string;
  fallback?: AuthFallback[];
};

export type AuthSuccessResponse<T = unknown> = {
  ok: true;
  data?: T;
  next?: string;
};

export type AuthResponse<T = unknown> = AuthSuccessResponse<T> | AuthErrorResponse;

export type SessionUser = {
  id: string;
  email?: string;
  profile?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
};

export type SessionPayload = {
  authenticated: boolean;
  token?: string;
  user?: SessionUser;
};

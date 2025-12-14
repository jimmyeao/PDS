export interface User {
  id: number;
  username: string;
  email?: string;
  isMfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginDto {
  username: string;
  password: string;
  mfaCode?: string;
}

export interface RegisterDto {
  username: string;
  password: string;
  email?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface MfaSetupResponse {
  secret: string;
  qrCodeUri: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface JwtPayload {
  sub: number;
  username: string;
  iat?: number;
  exp?: number;
}

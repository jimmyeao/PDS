export interface User {
  id: number;
  username: string;
  email?: string;
  displayName?: string;
  isMfaEnabled: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
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

// User management DTOs
export interface CreateUserDto {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
}

export interface UpdateUserDto {
  email?: string;
  displayName?: string;
  password?: string;
}

export interface UserListDto {
  id: number;
  username: string;
  email?: string;
  displayName?: string;
  isMfaEnabled: boolean;
  lastLoginAt?: Date;
}

import { z } from 'zod';
export const registerSchema = z.object({
  name:     z.string().min(2).max(100).trim(),
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(72).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Harus ada huruf besar, kecil, dan angka'),
});
export const loginSchema = z.object({
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});
export const refreshTokenSchema = z.object({ refreshToken: z.string().min(1) });
export type RegisterInput     = z.infer<typeof registerSchema>;
export type LoginInput        = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export interface JwtPayload { sub: string; email: string; role: 'admin' | 'user'; tokenVersion: string; }

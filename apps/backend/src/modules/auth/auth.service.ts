import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import { users, refreshTokens, devices } from '../../../drizzle/schema';
import type { RegisterInput, LoginInput, JwtPayload } from './auth.schema';

const BCRYPT_ROUNDS = 12;

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async register(input: RegisterInput) {
    const db = this.fastify.db;

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing.length > 0) {
      throw { statusCode: 409, message: 'Email sudah terdaftar' };
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const [newUser] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash, role: 'user' })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    const tokens = await this.generateTokens(newUser);
    this.fastify.log.info(`User baru: ${newUser.email}`);
    return { user: newUser, ...tokens };
  }

  async login(input: LoginInput) {
    const db = this.fastify.db;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user) {
      await bcrypt.compare(input.password, '$2b$12$invalidhashfortimingattack00000');
      throw { statusCode: 401, message: 'Email atau password salah' };
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw { statusCode: 401, message: 'Email atau password salah' };
    }

    const tokens = await this.generateTokens({
      id: user.id, email: user.email, role: user.role,
    });

    this.fastify.log.info(`User login: ${user.email}`);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      ...tokens,
    };
  }

  async refreshAccessToken(token: string) {
    const db = this.fastify.db;

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, token),
          eq(refreshTokens.isRevoked, false),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!stored) {
      throw { statusCode: 401, message: 'Refresh token tidak valid atau expired' };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1);

    if (!user) throw { statusCode: 401, message: 'User tidak ditemukan' };

    // Rotate: invalidate token lama
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, stored.id));

    return this.generateTokens({ id: user.id, email: user.email, role: user.role });
  }

  async logout(token: string) {
    const db = this.fastify.db;
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.token, token));
    return { message: 'Berhasil logout' };
  }

  async getProfile(userId: string) {
    const db = this.fastify.db;

    const [user] = await db
      .select({
        id: users.id, name: users.name, email: users.email,
        role: users.role, createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw { statusCode: 404, message: 'User tidak ditemukan' };

    const userDevices = await db
      .select({
        id: devices.id, name: devices.name,
        status: devices.status, location: devices.location,
        lastSeenAt: devices.lastSeenAt,
      })
      .from(devices)
      .where(eq(devices.userId, userId));

    return { ...user, devices: userDevices };
  }

  private async generateTokens(user: { id: string; email: string; role: 'admin' | 'user' }) {
    const db = this.fastify.db;

    const payload: JwtPayload = {
      sub: user.id, email: user.email, role: user.role, tokenVersion: '1',
    };

    const accessToken = this.fastify.jwt.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    });

    const refreshTokenValue = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.insert(refreshTokens).values({
      token: refreshTokenValue, userId: user.id, expiresAt,
    });

    return { accessToken, refreshToken: refreshTokenValue, expiresIn: 900 };
  }
}

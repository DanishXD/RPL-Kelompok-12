import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const deviceStatusEnum = pgEnum('device_status', [
  'active',
  'inactive',
  'error',
]);

// ── TABEL: users ──────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    // Password selalu di-hash dengan bcrypt — JANGAN simpan plain text!
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    tokenVersion: text('token_version').notNull().default('0'),
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUniqueIdx: uniqueIndex('users_email_unique_idx').on(table.email),
  })
);

// ── TABEL: refresh_tokens ─────────────────────────────────────────────────────
// Access token expired (15 menit) → pakai refresh token untuk dapat access token baru

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('refresh_tokens_token_idx').on(table.token),
    userIdx: index('refresh_tokens_user_idx').on(table.userId),
  })
);

// ── TABEL: devices ────────────────────────────────────────────────────────────
// Setiap ESP32 yang terdaftar. Satu user bisa punya banyak device (banyak kolam).

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Nama kolam yang mudah dibaca, contoh: "Kolam Lele Budi #1"
    name: text('name').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Token khusus untuk autentikasi ESP32 ke backend (bukan JWT user)
    deviceToken: text('device_token').notNull(),
    status: deviceStatusEnum('status').notNull().default('active'),
    location: text('location'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('devices_user_idx').on(table.userId),
    deviceTokenIdx: uniqueIndex('devices_token_unique_idx').on(table.deviceToken),
  })
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
  refreshTokens: many(refreshTokens),
}));

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, { fields: [devices.userId], references: [users.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

// ── TypeScript types ──────────────────────────────────────────────────────────

export type User        = typeof users.$inferSelect;
export type NewUser     = typeof users.$inferInsert;
export type Device      = typeof devices.$inferSelect;
export type NewDevice   = typeof devices.$inferInsert;
export type RefreshToken    = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

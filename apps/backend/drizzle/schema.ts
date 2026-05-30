import { pgTable, uuid, text, timestamp, boolean, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRoleEnum   = pgEnum('user_role',    ['admin', 'user']);
export const deviceStatusEnum = pgEnum('device_status', ['active', 'inactive', 'error']);

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         text('name').notNull(),
  email:        text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         userRoleEnum('role').notNull().default('user'),
  tokenVersion: text('token_version').notNull().default('0'),
  isVerified:   boolean('is_verified').notNull().default(false),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ emailIdx: uniqueIndex('users_email_unique_idx').on(t.email) }));

export const refreshTokens = pgTable('refresh_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  token:     text('token').notNull(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  isRevoked: boolean('is_revoked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tokenIdx: uniqueIndex('refresh_tokens_token_idx').on(t.token),
  userIdx:  index('refresh_tokens_user_idx').on(t.userId),
}));

export const devices = pgTable('devices', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceToken: text('device_token').notNull(),
  status:      deviceStatusEnum('status').notNull().default('active'),
  location:    text('location'),
  lastSeenAt:  timestamp('last_seen_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:        index('devices_user_idx').on(t.userId),
  deviceTokenIdx: uniqueIndex('devices_token_unique_idx').on(t.deviceToken),
}));

export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices), refreshTokens: many(refreshTokens),
}));
export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, { fields: [devices.userId], references: [users.id] }),
}));
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export type User        = typeof users.$inferSelect;
export type NewUser     = typeof users.$inferInsert;
export type Device      = typeof devices.$inferSelect;
export type NewDevice   = typeof devices.$inferInsert;

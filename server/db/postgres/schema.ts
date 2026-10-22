import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const openPlayStatus = pgEnum('open_play_status', ['scheduled', 'open', 'closed', 'cancelled']);
export const registrationStatus = pgEnum('open_play_registration_status', ['registered', 'checked_in', 'withdrawn']);
export const accountRole = pgEnum('account_role', ['player', 'host', 'administrator']);

export const accountRoles = pgTable('account_roles', {
  authUserId: text('auth_user_id').primaryKey(),
  role: accountRole('role').notNull(),
  grantedBy: text('granted_by'),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playerProfiles = pgTable('player_profiles', {
  authUserId: text('auth_user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  handle: text('handle'),
  avatarUrl: text('avatar_url'),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('player_profiles_handle_key').on(table.handle)]);

export const openPlaySessions = pgTable('open_play_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  venueName: text('venue_name'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  registrationOpensAt: timestamp('registration_opens_at', { withTimezone: true }),
  registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }),
  capacity: integer('capacity').notNull().default(32),
  status: openPlayStatus('status').notNull().default('scheduled'),
  episodeId: text('episode_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('open_play_sessions_status_starts_idx').on(table.status, table.startsAt)]);

export const openPlayRegistrations = pgTable('open_play_registrations', {
  sessionId: uuid('session_id').notNull().references(() => openPlaySessions.id, { onDelete: 'cascade' }),
  authUserId: text('auth_user_id').notNull().references(() => playerProfiles.authUserId, { onDelete: 'cascade' }),
  status: registrationStatus('status').notNull().default('registered'),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.authUserId] }),
  index('open_play_registrations_player_idx').on(table.authUserId, table.status),
]);

export const playerGameStats = pgTable('player_game_stats', {
  authUserId: text('auth_user_id').primaryKey().references(() => playerProfiles.authUserId, { onDelete: 'cascade' }),
  gamesPlayed: integer('games_played').notNull().default(0),
  wins: integer('wins').notNull().default(0),
  totalScore: integer('total_score').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playerProfileRelations = relations(playerProfiles, ({ many, one }) => ({
  registrations: many(openPlayRegistrations),
  stats: one(playerGameStats),
}));
export const openPlaySessionRelations = relations(openPlaySessions, ({ many }) => ({ registrations: many(openPlayRegistrations) }));
export const openPlayRegistrationRelations = relations(openPlayRegistrations, ({ one }) => ({
  session: one(openPlaySessions, { fields: [openPlayRegistrations.sessionId], references: [openPlaySessions.id] }),
  player: one(playerProfiles, { fields: [openPlayRegistrations.authUserId], references: [playerProfiles.authUserId] }),
}));

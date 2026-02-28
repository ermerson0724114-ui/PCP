import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, jsonb, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const pcpStates = pgTable("pcp_states", {
  id: serial("id").primaryKey(),
  weekKey: text("week_key").notNull().unique(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pcpComments = pgTable("pcp_comments", {
  id: serial("id").primaryKey(),
  weekKey: text("week_key").notNull().unique(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pcpParams = pgTable("pcp_params", {
  id: serial("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pcpCoverage = pgTable("pcp_coverage", {
  id: serial("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: serial("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const pcpNotes = pgTable("pcp_notes", {
  id: serial("id").primaryKey(),
  weekKey: text("week_key").notNull().unique(),
  notes: text("notes").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PcpState = typeof pcpStates.$inferSelect;
export type PcpComment = typeof pcpComments.$inferSelect;
export type PcpCoverage = typeof pcpCoverage.$inferSelect;
export type PcpNotes = typeof pcpNotes.$inferSelect;

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { gt } from "drizzle-orm";
import {
  type User,
  type InsertUser,
  users,
  pcpStates,
  pcpComments,
  pcpParams,
  pcpCoverage,
  pcpNotes,
  authTokens,
} from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin?: boolean }): Promise<User>;

  getPcpState(weekKey: string): Promise<any | null>;
  savePcpState(weekKey: string, data: any): Promise<void>;
  getAllPcpStates(): Promise<Array<{ weekKey: string; data: any }>>;

  getPcpComments(weekKey: string): Promise<any | null>;
  savePcpComments(weekKey: string, data: any): Promise<void>;
  getAllPcpComments(): Promise<Record<string, any>>;
  getAllPcpNotes(): Promise<Record<string, string>>;

  getPcpParams(): Promise<any | null>;
  savePcpParams(data: any): Promise<void>;

  getPcpCoverage(): Promise<any | null>;
  savePcpCoverage(data: any): Promise<void>;

  getPcpNotes(weekKey: string): Promise<string>;
  savePcpNotes(weekKey: string, notes: string): Promise<void>;

  saveToken(token: string, userId: number, expiresAt: Date): Promise<void>;
  getUserIdByToken(token: string): Promise<number | null>;
  deleteToken(token: string): Promise<void>;
  deleteUserTokens(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser & { isAdmin?: boolean }): Promise<User> {
    const result = await db.insert(users).values({
      username: insertUser.username,
      password: insertUser.password,
      isAdmin: insertUser.isAdmin ?? false,
    }).returning();
    return result[0];
  }

  async getPcpState(weekKey: string): Promise<any | null> {
    const result = await db.select().from(pcpStates).where(eq(pcpStates.weekKey, weekKey));
    return result[0]?.data ?? null;
  }

  async savePcpState(weekKey: string, data: any): Promise<void> {
    const existing = await db.select().from(pcpStates).where(eq(pcpStates.weekKey, weekKey));
    if (existing.length > 0) {
      await db.update(pcpStates).set({ data, updatedAt: new Date() }).where(eq(pcpStates.weekKey, weekKey));
    } else {
      await db.insert(pcpStates).values({ weekKey, data });
    }
  }

  async getAllPcpStates(): Promise<Array<{ weekKey: string; data: any }>> {
    const result = await db.select().from(pcpStates);
    return result.map(r => ({ weekKey: r.weekKey, data: r.data }));
  }

  async getAllPcpComments(): Promise<Record<string, any>> {
    const result = await db.select().from(pcpComments);
    const out: Record<string, any> = {};
    for (const r of result) {
      out[r.weekKey] = r.data;
    }
    return out;
  }

  async getAllPcpNotes(): Promise<Record<string, string>> {
    const result = await db.select().from(pcpNotes);
    const out: Record<string, string> = {};
    for (const r of result) {
      out[r.weekKey] = r.notes;
    }
    return out;
  }

  async getPcpComments(weekKey: string): Promise<any | null> {
    const result = await db.select().from(pcpComments).where(eq(pcpComments.weekKey, weekKey));
    return result[0]?.data ?? null;
  }

  async savePcpComments(weekKey: string, data: any): Promise<void> {
    const existing = await db.select().from(pcpComments).where(eq(pcpComments.weekKey, weekKey));
    if (existing.length > 0) {
      await db.update(pcpComments).set({ data, updatedAt: new Date() }).where(eq(pcpComments.weekKey, weekKey));
    } else {
      await db.insert(pcpComments).values({ weekKey, data });
    }
  }

  async getPcpParams(): Promise<any | null> {
    const result = await db.select().from(pcpParams);
    return result[0]?.data ?? null;
  }

  async savePcpParams(data: any): Promise<void> {
    const existing = await db.select().from(pcpParams);
    if (existing.length > 0) {
      await db.update(pcpParams).set({ data, updatedAt: new Date() }).where(eq(pcpParams.id, existing[0].id));
    } else {
      await db.insert(pcpParams).values({ data });
    }
  }

  async getPcpCoverage(): Promise<any | null> {
    const result = await db.select().from(pcpCoverage);
    return result[0]?.data ?? null;
  }

  async savePcpCoverage(data: any): Promise<void> {
    const existing = await db.select().from(pcpCoverage);
    if (existing.length > 0) {
      await db.update(pcpCoverage).set({ data, updatedAt: new Date() }).where(eq(pcpCoverage.id, existing[0].id));
    } else {
      await db.insert(pcpCoverage).values({ data });
    }
  }

  async getPcpNotes(weekKey: string): Promise<string> {
    const result = await db.select().from(pcpNotes).where(eq(pcpNotes.weekKey, weekKey));
    return result[0]?.notes ?? "";
  }

  async savePcpNotes(weekKey: string, notes: string): Promise<void> {
    const existing = await db.select().from(pcpNotes).where(eq(pcpNotes.weekKey, weekKey));
    if (existing.length > 0) {
      await db.update(pcpNotes).set({ notes, updatedAt: new Date() }).where(eq(pcpNotes.weekKey, weekKey));
    } else {
      await db.insert(pcpNotes).values({ weekKey, notes });
    }
  }

  async saveToken(token: string, userId: number, expiresAt: Date): Promise<void> {
    await db.insert(authTokens).values({ token, userId, expiresAt });
  }

  async getUserIdByToken(token: string): Promise<number | null> {
    const result = await db.select().from(authTokens)
      .where(eq(authTokens.token, token));
    if (!result[0]) return null;
    if (result[0].expiresAt < new Date()) {
      await db.delete(authTokens).where(eq(authTokens.token, token));
      return null;
    }
    return result[0].userId;
  }

  async deleteToken(token: string): Promise<void> {
    await db.delete(authTokens).where(eq(authTokens.token, token));
  }

  async deleteUserTokens(userId: number): Promise<void> {
    await db.delete(authTokens).where(eq(authTokens.userId, userId));
  }
}

export const storage = new DatabaseStorage();

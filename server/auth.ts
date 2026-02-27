import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { Request, Response, NextFunction } from "express";

const scryptAsync = promisify(scrypt);

const TOKEN_EXPIRY_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(
  supplied: string,
  stored: string
): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function createToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await storage.saveToken(token, userId, expiresAt);
  return token;
}

export async function removeToken(token: string): Promise<void> {
  await storage.deleteToken(token);
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userId = await storage.getUserIdByToken(token);
    if (userId) {
      const user = await storage.getUser(userId);
      if (user) {
        (req as any).user = user;
        (req as any).isAuthenticated = () => true;
      }
    }
  }
  if (!(req as any).isAuthenticated) {
    (req as any).isAuthenticated = () => false;
  }
  next();
}

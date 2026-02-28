import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { hashPassword, comparePasswords, createToken, removeToken, authMiddleware } from "./auth";
import path from "path";

function getCurrentISOWeek(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function addWeeksToISO(isoWeek: string, n: number): string {
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime());
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7 + n * 7);
  const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wn = Math.ceil((((d.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wn).padStart(2, '0')}`;
}

function getExpectedWeekKeys(): string[] {
  const current = getCurrentISOWeek();
  const keys: string[] = [];
  for (let i = 0; i < 9; i++) {
    keys.push(addWeeksToISO(current, i));
  }
  return keys;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req as any).isAuthenticated()) return next();
  res.status(401).json({ message: "Não autenticado" });
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).isAuthenticated() && (req as any).user?.isAdmin) return next();
  res.status(403).json({ message: "Acesso negado" });
}

async function seedAdmin() {
  const existing = await storage.getUserByUsername("admin");
  if (!existing) {
    const hashed = await hashPassword("admin123");
    await storage.createUser({ username: "admin", password: hashed, isAdmin: true });
    console.log("Admin user created: admin / admin123");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(authMiddleware);

  await seedAdmin();

  app.get("/api/pcp.html", (_req, res) => {
    const dir = typeof import.meta.dirname === "string"
      ? import.meta.dirname
      : __dirname;
    if (process.env.NODE_ENV === "production") {
      res.sendFile(path.resolve(dir, "public", "pcp.html"));
    } else {
      res.sendFile(path.resolve(dir, "..", "client", "public", "pcp.html"));
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Usuário não encontrado" });
      }
      const valid = await comparePasswords(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Senha incorreta" });
      }
      const token = await createToken(user.id);
      const { password: _, ...safe } = user;
      res.json({ ...safe, token });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Erro interno ao fazer login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      removeToken(authHeader.slice(7));
    }
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!(req as any).isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
    const { password, ...safe } = (req as any).user!;
    res.json(safe);
  });

  app.get("/api/pcp/state/:weekKey", async (req, res) => {
    const data = await storage.getPcpState(req.params.weekKey);
    res.json({ data });
  });

  app.post("/api/pcp/state/:weekKey", requireAdmin, async (req, res) => {
    await storage.savePcpState(req.params.weekKey, req.body.data);
    res.json({ ok: true });
  });

  app.get("/api/pcp/states", async (_req, res) => {
    const states = await storage.getAllPcpStates();
    res.json({ states });
  });

  app.post("/api/pcp/save-all", requireAdmin, async (req, res) => {
    try {
      const { weeks, comments, params, notes, coverage } = req.body;

      if (weeks && typeof weeks === "object") {
        for (const [weekKey, data] of Object.entries(weeks)) {
          await storage.savePcpState(weekKey, data);
        }
      }

      if (comments && typeof comments === "object") {
        for (const [weekKey, data] of Object.entries(comments)) {
          await storage.savePcpComments(weekKey, data);
        }
      }

      if (params) {
        await storage.savePcpParams(params);
      }

      if (notes && typeof notes === "object") {
        for (const [weekKey, text] of Object.entries(notes)) {
          await storage.savePcpNotes(weekKey, text as string);
        }
      }

      if (coverage) {
        await storage.savePcpCoverage(coverage);
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error("Save all error:", err);
      res.status(500).json({ message: "Erro ao salvar: " + err.message });
    }
  });

  app.get("/api/pcp/comments/:weekKey", async (req, res) => {
    const data = await storage.getPcpComments(req.params.weekKey);
    res.json({ data });
  });

  app.get("/api/pcp/params", async (_req, res) => {
    const data = await storage.getPcpParams();
    res.json({ data });
  });

  app.get("/api/pcp/coverage", async (_req, res) => {
    const data = await storage.getPcpCoverage();
    res.json({ data });
  });

  app.post("/api/pcp/coverage", requireAdmin, async (req, res) => {
    await storage.savePcpCoverage(req.body.data);
    res.json({ ok: true });
  });

  app.get("/api/pcp/notes/:weekKey", async (req, res) => {
    const notes = await storage.getPcpNotes(req.params.weekKey);
    res.json({ notes });
  });

  app.get("/api/pcp/full-state", async (_req, res) => {
    try {
      const allStates = await storage.getAllPcpStates();
      const weeks: Record<string, any> = {};
      for (const s of allStates) {
        weeks[s.weekKey] = s.data;
      }

      const params = await storage.getPcpParams();
      const coverage = await storage.getPcpCoverage();
      const comments = await storage.getAllPcpComments();
      const notes = await storage.getAllPcpNotes();
      const expectedWeeks = getExpectedWeekKeys();

      res.json({ weeks, params, coverage, comments, notes, expectedWeeks });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}

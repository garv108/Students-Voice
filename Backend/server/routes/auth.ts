import { Express } from "express";
import { storage } from "../storage";
import { insertUserSchema, loginSchema } from "../../shared/schema";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(
  supplied: string,
  stored: string
): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const buf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return buf.toString("hex") === hashedPassword;
}

export function registerAuthRoutes(app: Express) {

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      const existingUsername = await storage.getUserByUsername(
        data.username
      );
      if (existingUsername) {
        return res
          .status(400)
          .json({ message: "Username already taken" });
      }

      const existingEmail = await storage.getUserByEmail(
        data.email
      );
      if (existingEmail) {
        return res
          .status(400)
          .json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(
        data.password
      );

      let collegeId: string | null = null;

      if (data.college) {
        const result = await db.execute(
          sql`SELECT id FROM colleges WHERE name = ${data.college} LIMIT 1`
        );

        if (result.rows.length > 0) {
          collegeId = result.rows[0].id;
        }
      }

      const user = await storage.createUser({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        name: data.name,
        phone: data.phone,
        rollNumber: data.rollNumber,
        semester: data.semester,
        college: data.college,
        collegeId: collegeId ?? undefined,
        userType: data.userType,
      });

      (req as any).session.userId = user.id;

      res.json({
        user: { ...user, password: undefined },
      });

    } catch (error) {

      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message: error.errors[0].message,
          });
      }

      console.error("Signup error:", error);

      res.status(500).json({
        message: "Failed to create account",
      });

    }
  });



  app.post("/api/auth/login", async (req, res) => {

    try {

      const data = loginSchema.parse(req.body);

      const user =
        await storage.validatePassword(
          data.username,
          data.password
        );

      if (!user) {
        return res.status(401).json({
          message:
            "Invalid username or password",
        });
      }

      (req as any).session.userId = user.id;

      res.json({
        user: {
          ...user,
          password: undefined,
        },
      });

    } catch (error) {

      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message:
              error.errors[0].message,
          });
      }

      console.error("Login error:", error);

      res.status(500).json({
        message: "Login failed",
      });

    }

  });



  app.post("/api/auth/logout", (req, res) => {

    (req as any).session.destroy(
      (err: any) => {

        if (err) {
          return res.status(500).json({
            message: "Logout failed",
          });
        }

        res.json({
          message:
            "Logged out successfully",
        });

      }
    );

  });



  app.get("/api/auth/me", async (req, res) => {

    if (!(req as any).session.userId) {
      return res
        .status(401)
        .json({
          message:
            "Not authenticated",
        });
    }

    const user =
      await storage.getUser(
        (req as any).session.userId
      );

    if (!user) {

      (req as any).session.destroy(
        () => {}
      );

      return res
        .status(401)
        .json({
          message:
            "User not found",
        });

    }

    res.json({
      user: {
        ...user,
        password: undefined,
      },
    });

  });

}
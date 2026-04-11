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
import crypto from "crypto";
import { sendVerificationEmail } from "../emailService";

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

  // SIGNUP - with email verification (NO auto-login)
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
        // User starts unverified   isVerified: false,
      });

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await storage.setVerificationToken(user.id, verificationToken, tokenExpiry);
      
      // Send verification email
      const emailSent = await sendVerificationEmail({
        email: user.email,
        name: user.name || user.username,
        verificationToken: verificationToken,
      });
      
      // IMPORTANT: DO NOT auto-login - user must verify email first
      // (req as any).session.userId = user.id; // ❌ REMOVED
      
      res.json({
        message: emailSent 
          ? "Account created! Please check your email to verify your account."
          : "Account created! We couldn't send verification email. Please contact support.",
        requiresVerification: true,
        userId: user.id,
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

  // VERIFY EMAIL - New endpoint
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: "Invalid verification token" });
      }
      
      const verified = await storage.verifyUser(token);
      
      if (!verified) {
        return res.status(400).json({ 
          message: "Invalid or expired verification token. Please request a new one." 
        });
      }
      
      res.json({ 
        message: "Email verified successfully! You can now login.",
        verified: true 
      });
      
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // LOGIN - with verification check
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await storage.validatePassword(
        data.username,
        data.password
      );

      if (!user) {
        return res.status(401).json({
          message: "Invalid username or password",
        });
      }

      // ✅ CHECK IF EMAIL IS VERIFIED
      const isVerified = await storage.isUserVerified(user.id);
      if (!isVerified) {
        return res.status(403).json({ 
          message: "Please verify your email before logging in. Check your inbox for verification link." 
        });
      }

      // Check if user is banned
      if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
        return res.status(403).json({ 
          message: `Account is banned until ${new Date(user.bannedUntil).toLocaleDateString()}` 
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
            message: error.errors[0].message,
          });
      }

      console.error("Login error:", error);

      res.status(500).json({
        message: "Login failed",
      });
    }
  });

  // LOGOUT
  app.post("/api/auth/logout", (req, res) => {
    (req as any).session.destroy(
      (err: any) => {
        if (err) {
          return res.status(500).json({
            message: "Logout failed",
          });
        }
        res.json({
          message: "Logged out successfully",
        });
      }
    );
  });

  // GET CURRENT USER
  app.get("/api/auth/me", async (req, res) => {
    if (!(req as any).session.userId) {
      return res
        .status(401)
        .json({
          message: "Not authenticated",
        });
    }

    const user = await storage.getUser(
      (req as any).session.userId
    );

    if (!user) {
      (req as any).session.destroy(
        () => {}
      );
      return res
        .status(401)
        .json({
          message: "User not found",
        });
    }

    res.json({
      user: {
        ...user,
        password: undefined,
      },
    });
  });

  // ========== TEMPORARY TEST ENDPOINT ==========
  app.post("/api/auth/test-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      console.log("🧪 Test email to:", email);
      const result = await sendVerificationEmail({
        email,
        name: "Test User",
        verificationToken: "test-token-123",
      });

      console.log("📧 Test email result:", result);
      res.json(result);
    } catch (error) {
      console.error("❌ Test email error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
}
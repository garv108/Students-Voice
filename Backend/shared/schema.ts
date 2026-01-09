import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["student", "moderator", "admin"]);
export const statusEnum = pgEnum("status", ["pending", "in_progress", "solved"]);
export const urgencyEnum = pgEnum("urgency", ["normal", "urgent", "critical", "top_priority", "emergency"]);
export const severityEnum = pgEnum("severity", ["good", "average", "poor", "bad", "worst", "critical"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "verified", "rejected"]);

// FIXED: Match existing user_sessions table structure
export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.sid], // Note: Using sid since no user_id column
    references: [users.id],
  }),
}));

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("student"),
  
  // New verification columns
  rollNumber: text("roll_number").unique(),
  userType: text("user_type").default("student"), // student, faculty, admin
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),  
  bannedUntil: timestamp("banned_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  complaints: many(complaints),
  reactions: many(reactions),
  abuseLogs: many(abuseLogs),
  sessions: many(userSessions),
}));

export const complaints = pgTable("complaints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  originalText: text("original_text").notNull(),
  summary: text("summary"),
  severity: severityEnum("severity").default("average"),
  keywords: text("keywords").array(),
  status: statusEnum("status").notNull().default("pending"),
  solved: boolean("solved").notNull().default(false),
  solvedBy: varchar("solved_by").references(() => users.id),
  solvedAt: timestamp("solved_at"),
  urgency: urgencyEnum("urgency").notNull().default("normal"),
  similarComplaintsCount: integer("similar_complaints_count").notNull().default(0),
  clusterId: varchar("cluster_id"),
  likesCount: integer("likes_count").notNull().default(0),
  dislikesCount: integer("dislikes_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  user: one(users, {
    fields: [complaints.userId],
    references: [users.id],
  }),
  solvedByUser: one(users, {
    fields: [complaints.solvedBy],
    references: [users.id],
  }),
  reactions: many(reactions),
  cluster: one(clusterGroups, {
    fields: [complaints.clusterId],
    references: [clusterGroups.id],
  }),
}));

export const reactions = pgTable("reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  complaintId: varchar("complaint_id").notNull().references(() => complaints.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reactionsRelations = relations(reactions, ({ one }) => ({
  complaint: one(complaints, {
    fields: [reactions.complaintId],
    references: [complaints.id],
  }),
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
}));

export const likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  complaintId: varchar("complaint_id").notNull().references(() => complaints.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isLike: boolean("is_like").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const likesRelations = relations(likes, ({ one }) => ({
  complaint: one(complaints, {
    fields: [likes.complaintId],
    references: [complaints.id],
  }),
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
}));

export const abuseLogs = pgTable("abuse_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  flaggedText: text("flagged_text").notNull(),
  detectedWords: text("detected_words").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const abuseLogsRelations = relations(abuseLogs, ({ one }) => ({
  user: one(users, {
    fields: [abuseLogs.userId],
    references: [users.id],
  }),
}));

export const clusterGroups = pgTable("cluster_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  representativeProblemId: varchar("representative_problem_id"),
  representativeSummary: text("representative_summary"),
  keywords: text("keywords").array(),
  problemCount: integer("problem_count").notNull().default(0),
  severity: severityEnum("severity").default("average"),
  urgency: urgencyEnum("urgency").notNull().default("normal"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const clusterGroupsRelations = relations(clusterGroups, ({ many }) => ({
  complaints: many(complaints),
}));

// EduNotes Tables
export const notesCategories = pgTable("notes_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  branch: text("branch").notNull(),
  semester: integer("semester").notNull(),
  subject: text("subject").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notesCategoriesRelations = relations(notesCategories, ({ many }) => ({
  notesFiles: many(notesFiles),
  notesBundles: many(notesBundles),
}));

export const notesFiles = pgTable("notes_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => notesCategories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(), // Supabase URL
  price: integer("price").notNull(), // Price in rupees
  isFree: boolean("is_free").notNull().default(false), // Semester 1 files are free
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notesFilesRelations = relations(notesFiles, ({ one, many }) => ({
  category: one(notesCategories, {
    fields: [notesFiles.categoryId],
    references: [notesCategories.id],
  }),
  uploader: one(users, {
    fields: [notesFiles.uploadedBy],
    references: [users.id],
  }),
  purchases: many(notesPurchases),
}));

export const notesPurchases = pgTable("notes_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").notNull().references(() => notesFiles.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  paymentProof: text("payment_proof").notNull(), // Screenshot URL
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  verifiedBy: varchar("verified_by").references(() => users.id), // Admin who verified
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notesPurchasesRelations = relations(notesPurchases, ({ one }) => ({
  file: one(notesFiles, {
    fields: [notesPurchases.fileId],
    references: [notesFiles.id],
  }),
  buyer: one(users, {
    fields: [notesPurchases.buyerId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [notesPurchases.verifiedBy],
    references: [users.id],
  }),
}));

export const notesBundles = pgTable("notes_bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => notesCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // Discounted bundle price
  discountPercentage: integer("discount_percentage").notNull(),
  fileIds: text("file_ids").array().notNull(), // Array of file IDs in this bundle
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notesBundlesRelations = relations(notesBundles, ({ one, many }) => ({
  category: one(notesCategories, {
    fields: [notesBundles.categoryId],
    references: [notesCategories.id],
  }),
  purchases: many(bundlePurchases),
}));

export const bundlePurchases = pgTable("bundle_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleId: varchar("bundle_id").notNull().references(() => notesBundles.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  paymentProof: text("payment_proof").notNull(), // Screenshot URL
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  verifiedBy: varchar("verified_by").references(() => users.id), // Admin who verified
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bundlePurchasesRelations = relations(bundlePurchases, ({ one }) => ({
  bundle: one(notesBundles, {
    fields: [bundlePurchases.bundleId],
    references: [notesBundles.id],
  }),
  buyer: one(users, {
    fields: [bundlePurchases.buyerId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [bundlePurchases.verifiedBy],
    references: [users.id],
  }),
}));

// Validation schemas
export const insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rollNumber: z.string().regex(
    /^(2[2-6])(cs|ce|me|ee)\d{2}$/i,
    "Roll number must be in format: YYbbNN (e.g., 22CS05, 24EE12)"
  ),
  userType: z.enum(["student", "faculty"]).default("student"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email"),
});

export const insertComplaintSchema = z.object({
  originalText: z.string().min(1, "Complaint text is required"),
});

export const insertReactionSchema = z.object({
  complaintId: z.string().min(1, "Complaint ID is required"),
  emoji: z.string().min(1, "Emoji is required"),
});

// Type exports
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Reaction = typeof reactions.$inferSelect;
export type InsertReaction = z.infer<typeof insertReactionSchema>;
export type Like = typeof likes.$inferSelect;
export type AbuseLog = typeof abuseLogs.$inferSelect;
export type ClusterGroup = typeof clusterGroups.$inferSelect;
export type NotesCategory = typeof notesCategories.$inferSelect;
export type NotesFile = typeof notesFiles.$inferSelect;
export type NotesPurchase = typeof notesPurchases.$inferSelect;
export type NotesBundle = typeof notesBundles.$inferSelect;
export type BundlePurchase = typeof bundlePurchases.$inferSelect;
export type VerifyEmail = z.infer<typeof verifyEmailSchema>;
export type ResendVerification = z.infer<typeof resendVerificationSchema>;

export const EMOJI_REACTIONS = ["thumbsup", "thumbsdown", "fire", "warning", "check"] as const;
export type EmojiReaction = typeof EMOJI_REACTIONS[number];

export const URGENCY_THRESHOLDS = {
  normal: 0,
  urgent: 10,
  critical: 25,
  top_priority: 50,
  emergency: 100,
} as const;

export function calculateUrgency(count: number): typeof urgencyEnum.enumValues[number] {
  if (count >= 100) return "emergency";
  if (count >= 50) return "top_priority";
  if (count >= 25) return "critical";
  if (count >= 10) return "urgent";
  return "normal";
}
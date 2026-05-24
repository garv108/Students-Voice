import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["student", "moderator", "admin"]);
export const statusEnum = pgEnum("status", ["pending", "in_progress", "solved", "draft", "withdrawn"]);
export const urgencyEnum = pgEnum("urgency", ["normal", "urgent", "critical", "top_priority", "emergency"]);
export const severityEnum = pgEnum("severity", ["good", "average", "poor", "bad", "worst", "critical"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "verified", "rejected"]);

export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.sid],
    references: [users.id],
  }),
}));

export const colleges = pgTable("colleges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  code: text("code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  layout: json("layout"),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const collegeSettings = pgTable("college_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collegeId: varchar("college_id").references(() => colleges.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => templates.id),
  themeColor: text("theme_color"),
  logoUrl: text("logo_url"),
  features: json("features"),
  customFields: json("custom_fields"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  name: text("name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  rollNumber: text("roll_number"),
  semester: integer("semester"),
  college: text("college"),
  collegeId: varchar("college_id"),
  userType: text("user_type"),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("student"),
  bannedUntil: timestamp("banned_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isVerified: boolean("is_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  verifiedAt: timestamp("verified_at"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  requestedCollege: text("requested_college"),
  department: text("department"),
  course: text("course"),
});

export const collegeSettingsRelations = relations(collegeSettings, ({ one }) => ({
  college: one(colleges, {
    fields: [collegeSettings.collegeId],
    references: [colleges.id],
  }),
  template: one(templates, {
    fields: [collegeSettings.templateId],
    references: [templates.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  complaints: many(complaints),
  reactions: many(reactions),
  abuseLogs: many(abuseLogs),
  sessions: many(userSessions),
  complaintMessages: many(complaintMessages),
}));

export const complaints = pgTable("complaints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  collegeId: varchar("college_id"),
  username: text("username").notNull(),
  originalText: text("original_text").notNull(),
  summary: text("summary"),
  severity: severityEnum("severity").default("average"),
  keywords: text("keywords").array(),
  status: statusEnum("status").notNull().default("pending"),
  category: text("category"),
  solved: boolean("solved").notNull().default(false),
  solvedBy: varchar("solved_by").references(() => users.id),
  solvedAt: timestamp("solved_at"),
  urgency: urgencyEnum("urgency").notNull().default("normal"),
  similarComplaintsCount: integer("similar_complaints_count").notNull().default(0),
  clusterId: varchar("cluster_id"),
  likesCount: integer("likes_count").notNull().default(0),
  dislikesCount: integer("dislikes_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  withdrawnAt: timestamp("withdrawn_at"),
  slaDeadline: timestamp("sla_deadline"),   // ← NEW: expected resolution deadline
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
  messages: many(complaintMessages),
}));

export const complaintMessages = pgTable("complaint_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  complaintId: varchar("complaint_id").notNull().references(() => complaints.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const complaintMessagesRelations = relations(complaintMessages, ({ one }) => ({
  complaint: one(complaints, {
    fields: [complaintMessages.complaintId],
    references: [complaints.id],
  }),
  sender: one(users, {
    fields: [complaintMessages.senderId],
    references: [users.id],
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

// ----- Schemas -----
export const insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  name: z.string().optional(),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  branch: z.string().optional(),
  rollNumber: z.string().optional(),
  semester: z.number().optional(),
  college: z.string().optional(),
  collegeId: z.string().optional(),
  userType: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isVerified: z.boolean().optional(),
  department: z.string().optional(),
  role: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
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
  originalText: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["pending", "draft"]).optional().default("pending"),
}).refine(data => data.originalText || data.description, {
  message: "Complaint text is required",
  path: ["originalText"],
});

export const insertReactionSchema = z.object({
  complaintId: z.string().min(1, "Complaint ID is required"),
  emoji: z.string().min(1, "Emoji is required"),
});

// Type exports
export type UserSession = typeof userSessions.$inferSelect;
export type College = typeof colleges.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type CollegeSettings = typeof collegeSettings.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Reaction = typeof reactions.$inferSelect;
export type InsertReaction = z.infer<typeof insertReactionSchema>;
export type Like = typeof likes.$inferSelect;
export type AbuseLog = typeof abuseLogs.$inferSelect;
export type ClusterGroup = typeof clusterGroups.$inferSelect;
export type ComplaintMessage = typeof complaintMessages.$inferSelect;
export type InsertComplaintMessage = typeof complaintMessages.$inferInsert;
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
/* import { sql, relations } from "drizzle-orm";
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
    fields: [userSessions.sid],
    references: [users.id],
  }),
}));

export const colleges = pgTable("colleges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  code: text("code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ✅ NEW: templates table
export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  layout: json("layout"),
  config: json("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ✅ NEW: college_settings table
export const collegeSettings = pgTable("college_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collegeId: varchar("college_id").references(() => colleges.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => templates.id),
  themeColor: text("theme_color"),
  logoUrl: text("logo_url"),
  features: json("features"),
  customFields: json("custom_fields"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  name: text("name"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  rollNumber: text("roll_number"),
  semester: integer("semester"),
  college: text("college"),
  collegeId: varchar("college_id"),
  userType: text("user_type"),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("student"),
  bannedUntil: timestamp("banned_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  
  // ✅ NEW FIELDS FOR EMAIL VERIFICATION
  isVerified: boolean("is_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
  verifiedAt: timestamp("verified_at"),
});

// ✅ NEW: relations for collegeSettings and templates
export const collegeSettingsRelations = relations(collegeSettings, ({ one }) => ({
  college: one(colleges, {
    fields: [collegeSettings.collegeId],
    references: [colleges.id],
  }),
  template: one(templates, {
    fields: [collegeSettings.templateId],
    references: [templates.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  complaints: many(complaints),
  reactions: many(reactions),
  abuseLogs: many(abuseLogs),
  sessions: many(userSessions),
}));

export const complaints = pgTable("complaints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  collegeId: varchar("college_id"),
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
  fileUrl: text("file_url").notNull(),
  price: integer("price").notNull(),
  isFree: boolean("is_free").notNull().default(false),
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
  paymentProof: text("payment_proof").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  verifiedBy: varchar("verified_by").references(() => users.id),
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
  price: integer("price").notNull(),
  discountPercentage: integer("discount_percentage").notNull(),
  fileIds: text("file_ids").array().notNull(),
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
  paymentProof: text("payment_proof").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  verifiedBy: varchar("verified_by").references(() => users.id),
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


// Validation schemas (UPDATED)
export const insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  name: z.string().optional(),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  rollNumber: z.string().optional(),
  semester: z.number().optional(),
  college: z.string().optional(),
  collegeId: z.string().optional(),
  userType: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
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
export type College = typeof colleges.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type CollegeSettings = typeof collegeSettings.$inferSelect;
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
}*/
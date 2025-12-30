import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["student", "moderator", "admin"]);
export const statusEnum = pgEnum("status", ["pending", "in_progress", "solved"]);
export const urgencyEnum = pgEnum("urgency", ["normal", "urgent", "critical", "top_priority", "emergency"]);
export const severityEnum = pgEnum("severity", ["good", "average", "poor", "bad", "worst", "critical"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("student"),
  bannedUntil: timestamp("banned_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  complaints: many(complaints),
  reactions: many(reactions),
  abuseLogs: many(abuseLogs),
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

export const insertUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertComplaintSchema = z.object({
  originalText: z.string().min(1, "Complaint text is required"),
});

export const insertReactionSchema = z.object({
  complaintId: z.string().min(1, "Complaint ID is required"),
  emoji: z.string().min(1, "Emoji is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Complaint = typeof complaints.$inferSelect;
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Reaction = typeof reactions.$inferSelect;
export type InsertReaction = z.infer<typeof insertReactionSchema>;
export type Like = typeof likes.$inferSelect;
export type AbuseLog = typeof abuseLogs.$inferSelect;
export type ClusterGroup = typeof clusterGroups.$inferSelect;

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


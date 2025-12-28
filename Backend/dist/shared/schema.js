"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URGENCY_THRESHOLDS = exports.EMOJI_REACTIONS = exports.insertReactionSchema = exports.insertComplaintSchema = exports.loginSchema = exports.insertUserSchema = exports.clusterGroupsRelations = exports.clusterGroups = exports.abuseLogsRelations = exports.abuseLogs = exports.likesRelations = exports.likes = exports.reactionsRelations = exports.reactions = exports.complaintsRelations = exports.complaints = exports.usersRelations = exports.users = exports.severityEnum = exports.urgencyEnum = exports.statusEnum = exports.roleEnum = void 0;
exports.calculateUrgency = calculateUrgency;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const zod_1 = require("zod");
exports.roleEnum = (0, pg_core_1.pgEnum)("role", ["student", "moderator", "admin"]);
exports.statusEnum = (0, pg_core_1.pgEnum)("status", ["pending", "in_progress", "solved"]);
exports.urgencyEnum = (0, pg_core_1.pgEnum)("urgency", ["normal", "urgent", "critical", "top_priority", "emergency"]);
exports.severityEnum = (0, pg_core_1.pgEnum)("severity", ["good", "average", "poor", "bad", "worst", "critical"]);
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
    role: (0, exports.roleEnum)("role").notNull().default("student"),
    bannedUntil: (0, pg_core_1.timestamp)("banned_until"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    complaints: many(exports.complaints),
    reactions: many(exports.reactions),
    abuseLogs: many(exports.abuseLogs),
}));
exports.complaints = (0, pg_core_1.pgTable)("complaints", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    username: (0, pg_core_1.text)("username").notNull(),
    originalText: (0, pg_core_1.text)("original_text").notNull(),
    summary: (0, pg_core_1.text)("summary"),
    severity: (0, exports.severityEnum)("severity").default("average"),
    keywords: (0, pg_core_1.text)("keywords").array(),
    status: (0, exports.statusEnum)("status").notNull().default("pending"),
    solved: (0, pg_core_1.boolean)("solved").notNull().default(false),
    solvedBy: (0, pg_core_1.varchar)("solved_by").references(() => exports.users.id),
    solvedAt: (0, pg_core_1.timestamp)("solved_at"),
    urgency: (0, exports.urgencyEnum)("urgency").notNull().default("normal"),
    similarComplaintsCount: (0, pg_core_1.integer)("similar_complaints_count").notNull().default(0),
    clusterId: (0, pg_core_1.varchar)("cluster_id"),
    likesCount: (0, pg_core_1.integer)("likes_count").notNull().default(0),
    dislikesCount: (0, pg_core_1.integer)("dislikes_count").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.complaintsRelations = (0, drizzle_orm_1.relations)(exports.complaints, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.complaints.userId],
        references: [exports.users.id],
    }),
    solvedByUser: one(exports.users, {
        fields: [exports.complaints.solvedBy],
        references: [exports.users.id],
    }),
    reactions: many(exports.reactions),
    cluster: one(exports.clusterGroups, {
        fields: [exports.complaints.clusterId],
        references: [exports.clusterGroups.id],
    }),
}));
exports.reactions = (0, pg_core_1.pgTable)("reactions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    complaintId: (0, pg_core_1.varchar)("complaint_id").notNull().references(() => exports.complaints.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    emoji: (0, pg_core_1.text)("emoji").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.reactionsRelations = (0, drizzle_orm_1.relations)(exports.reactions, ({ one }) => ({
    complaint: one(exports.complaints, {
        fields: [exports.reactions.complaintId],
        references: [exports.complaints.id],
    }),
    user: one(exports.users, {
        fields: [exports.reactions.userId],
        references: [exports.users.id],
    }),
}));
exports.likes = (0, pg_core_1.pgTable)("likes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    complaintId: (0, pg_core_1.varchar)("complaint_id").notNull().references(() => exports.complaints.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    isLike: (0, pg_core_1.boolean)("is_like").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.likesRelations = (0, drizzle_orm_1.relations)(exports.likes, ({ one }) => ({
    complaint: one(exports.complaints, {
        fields: [exports.likes.complaintId],
        references: [exports.complaints.id],
    }),
    user: one(exports.users, {
        fields: [exports.likes.userId],
        references: [exports.users.id],
    }),
}));
exports.abuseLogs = (0, pg_core_1.pgTable)("abuse_logs", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    username: (0, pg_core_1.text)("username").notNull(),
    flaggedText: (0, pg_core_1.text)("flagged_text").notNull(),
    detectedWords: (0, pg_core_1.text)("detected_words").array(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.abuseLogsRelations = (0, drizzle_orm_1.relations)(exports.abuseLogs, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.abuseLogs.userId],
        references: [exports.users.id],
    }),
}));
exports.clusterGroups = (0, pg_core_1.pgTable)("cluster_groups", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    representativeProblemId: (0, pg_core_1.varchar)("representative_problem_id"),
    representativeSummary: (0, pg_core_1.text)("representative_summary"),
    keywords: (0, pg_core_1.text)("keywords").array(),
    problemCount: (0, pg_core_1.integer)("problem_count").notNull().default(0),
    severity: (0, exports.severityEnum)("severity").default("average"),
    urgency: (0, exports.urgencyEnum)("urgency").notNull().default("normal"),
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").notNull().defaultNow(),
});
exports.clusterGroupsRelations = (0, drizzle_orm_1.relations)(exports.clusterGroups, ({ many }) => ({
    complaints: many(exports.complaints),
}));
exports.insertUserSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    email: zod_1.z.string().email("Invalid email"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.insertComplaintSchema = zod_1.z.object({
    originalText: zod_1.z.string().min(1, "Complaint text is required"),
});
exports.insertReactionSchema = zod_1.z.object({
    complaintId: zod_1.z.string().min(1, "Complaint ID is required"),
    emoji: zod_1.z.string().min(1, "Emoji is required"),
});
exports.EMOJI_REACTIONS = ["thumbsup", "thumbsdown", "fire", "warning", "check"];
exports.URGENCY_THRESHOLDS = {
    normal: 0,
    urgent: 10,
    critical: 25,
    top_priority: 50,
    emergency: 100,
};
function calculateUrgency(count) {
    if (count >= 100)
        return "emergency";
    if (count >= 50)
        return "top_priority";
    if (count >= 25)
        return "critical";
    if (count >= 10)
        return "urgent";
    return "normal";
}

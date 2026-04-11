"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URGENCY_THRESHOLDS = exports.EMOJI_REACTIONS = exports.insertReactionSchema = exports.insertComplaintSchema = exports.resendVerificationSchema = exports.verifyEmailSchema = exports.loginSchema = exports.insertUserSchema = exports.bundlePurchasesRelations = exports.bundlePurchases = exports.notesBundlesRelations = exports.notesBundles = exports.notesPurchasesRelations = exports.notesPurchases = exports.notesFilesRelations = exports.notesFiles = exports.notesCategoriesRelations = exports.notesCategories = exports.clusterGroupsRelations = exports.clusterGroups = exports.abuseLogsRelations = exports.abuseLogs = exports.likesRelations = exports.likes = exports.reactionsRelations = exports.reactions = exports.complaintsRelations = exports.complaints = exports.usersRelations = exports.collegeSettingsRelations = exports.users = exports.collegeSettings = exports.templates = exports.colleges = exports.userSessionsRelations = exports.userSessions = exports.paymentStatusEnum = exports.severityEnum = exports.urgencyEnum = exports.statusEnum = exports.roleEnum = void 0;
exports.calculateUrgency = calculateUrgency;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const zod_1 = require("zod");
exports.roleEnum = (0, pg_core_1.pgEnum)("role", ["student", "moderator", "admin"]);
exports.statusEnum = (0, pg_core_1.pgEnum)("status", ["pending", "in_progress", "solved"]);
exports.urgencyEnum = (0, pg_core_1.pgEnum)("urgency", ["normal", "urgent", "critical", "top_priority", "emergency"]);
exports.severityEnum = (0, pg_core_1.pgEnum)("severity", ["good", "average", "poor", "bad", "worst", "critical"]);
exports.paymentStatusEnum = (0, pg_core_1.pgEnum)("payment_status", ["pending", "verified", "rejected"]);
// FIXED: Match existing user_sessions table structure
exports.userSessions = (0, pg_core_1.pgTable)("user_sessions", {
    sid: (0, pg_core_1.varchar)("sid").primaryKey(),
    sess: (0, pg_core_1.json)("sess").notNull(),
    expire: (0, pg_core_1.timestamp)("expire").notNull(),
});
exports.userSessionsRelations = (0, drizzle_orm_1.relations)(exports.userSessions, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.userSessions.sid],
        references: [exports.users.id],
    }),
}));
exports.colleges = (0, pg_core_1.pgTable)("colleges", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    name: (0, pg_core_1.text)("name").notNull().unique(),
    code: (0, pg_core_1.text)("code"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// ✅ NEW: templates table
exports.templates = (0, pg_core_1.pgTable)("templates", {
    id: (0, pg_core_1.text)("id").primaryKey(),
    name: (0, pg_core_1.text)("name").notNull(),
    layout: (0, pg_core_1.json)("layout"),
    config: (0, pg_core_1.json)("config"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
// ✅ NEW: college_settings table
exports.collegeSettings = (0, pg_core_1.pgTable)("college_settings", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    collegeId: (0, pg_core_1.varchar)("college_id").references(() => exports.colleges.id, { onDelete: "cascade" }),
    templateId: (0, pg_core_1.text)("template_id").references(() => exports.templates.id),
    themeColor: (0, pg_core_1.text)("theme_color"),
    logoUrl: (0, pg_core_1.text)("logo_url"),
    features: (0, pg_core_1.json)("features"),
    customFields: (0, pg_core_1.json)("custom_fields"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    name: (0, pg_core_1.text)("name"),
    email: (0, pg_core_1.text)("email").notNull().unique(),
    phone: (0, pg_core_1.text)("phone"),
    rollNumber: (0, pg_core_1.text)("roll_number"),
    semester: (0, pg_core_1.integer)("semester"),
    college: (0, pg_core_1.text)("college"),
    collegeId: (0, pg_core_1.varchar)("college_id"),
    userType: (0, pg_core_1.text)("user_type"),
    password: (0, pg_core_1.text)("password").notNull(),
    role: (0, exports.roleEnum)("role").notNull().default("student"),
    bannedUntil: (0, pg_core_1.timestamp)("banned_until"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
    // ✅ NEW FIELDS FOR EMAIL VERIFICATION
    isVerified: (0, pg_core_1.boolean)("is_verified").notNull().default(false),
    verificationToken: (0, pg_core_1.text)("verification_token"),
    verificationTokenExpiry: (0, pg_core_1.timestamp)("verification_token_expiry"),
    verifiedAt: (0, pg_core_1.timestamp)("verified_at"),
});
// ✅ NEW: relations for collegeSettings and templates
exports.collegeSettingsRelations = (0, drizzle_orm_1.relations)(exports.collegeSettings, ({ one }) => ({
    college: one(exports.colleges, {
        fields: [exports.collegeSettings.collegeId],
        references: [exports.colleges.id],
    }),
    template: one(exports.templates, {
        fields: [exports.collegeSettings.templateId],
        references: [exports.templates.id],
    }),
}));
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many, one }) => ({
    complaints: many(exports.complaints),
    reactions: many(exports.reactions),
    abuseLogs: many(exports.abuseLogs),
    sessions: many(exports.userSessions),
}));
exports.complaints = (0, pg_core_1.pgTable)("complaints", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    collegeId: (0, pg_core_1.varchar)("college_id"),
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
// EduNotes Tables
exports.notesCategories = (0, pg_core_1.pgTable)("notes_categories", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    branch: (0, pg_core_1.text)("branch").notNull(),
    semester: (0, pg_core_1.integer)("semester").notNull(),
    subject: (0, pg_core_1.text)("subject").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.notesCategoriesRelations = (0, drizzle_orm_1.relations)(exports.notesCategories, ({ many }) => ({
    notesFiles: many(exports.notesFiles),
    notesBundles: many(exports.notesBundles),
}));
exports.notesFiles = (0, pg_core_1.pgTable)("notes_files", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    categoryId: (0, pg_core_1.varchar)("category_id").notNull().references(() => exports.notesCategories.id, { onDelete: "cascade" }),
    title: (0, pg_core_1.text)("title").notNull(),
    description: (0, pg_core_1.text)("description"),
    fileUrl: (0, pg_core_1.text)("file_url").notNull(),
    price: (0, pg_core_1.integer)("price").notNull(),
    isFree: (0, pg_core_1.boolean)("is_free").notNull().default(false),
    uploadedBy: (0, pg_core_1.varchar)("uploaded_by").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.notesFilesRelations = (0, drizzle_orm_1.relations)(exports.notesFiles, ({ one, many }) => ({
    category: one(exports.notesCategories, {
        fields: [exports.notesFiles.categoryId],
        references: [exports.notesCategories.id],
    }),
    uploader: one(exports.users, {
        fields: [exports.notesFiles.uploadedBy],
        references: [exports.users.id],
    }),
    purchases: many(exports.notesPurchases),
}));
exports.notesPurchases = (0, pg_core_1.pgTable)("notes_purchases", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    fileId: (0, pg_core_1.varchar)("file_id").notNull().references(() => exports.notesFiles.id, { onDelete: "cascade" }),
    buyerId: (0, pg_core_1.varchar)("buyer_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    paymentProof: (0, pg_core_1.text)("payment_proof").notNull(),
    paymentStatus: (0, exports.paymentStatusEnum)("payment_status").notNull().default("pending"),
    verifiedBy: (0, pg_core_1.varchar)("verified_by").references(() => exports.users.id),
    verifiedAt: (0, pg_core_1.timestamp)("verified_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.notesPurchasesRelations = (0, drizzle_orm_1.relations)(exports.notesPurchases, ({ one }) => ({
    file: one(exports.notesFiles, {
        fields: [exports.notesPurchases.fileId],
        references: [exports.notesFiles.id],
    }),
    buyer: one(exports.users, {
        fields: [exports.notesPurchases.buyerId],
        references: [exports.users.id],
    }),
    verifier: one(exports.users, {
        fields: [exports.notesPurchases.verifiedBy],
        references: [exports.users.id],
    }),
}));
exports.notesBundles = (0, pg_core_1.pgTable)("notes_bundles", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    categoryId: (0, pg_core_1.varchar)("category_id").notNull().references(() => exports.notesCategories.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    price: (0, pg_core_1.integer)("price").notNull(),
    discountPercentage: (0, pg_core_1.integer)("discount_percentage").notNull(),
    fileIds: (0, pg_core_1.text)("file_ids").array().notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.notesBundlesRelations = (0, drizzle_orm_1.relations)(exports.notesBundles, ({ one, many }) => ({
    category: one(exports.notesCategories, {
        fields: [exports.notesBundles.categoryId],
        references: [exports.notesCategories.id],
    }),
    purchases: many(exports.bundlePurchases),
}));
exports.bundlePurchases = (0, pg_core_1.pgTable)("bundle_purchases", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    bundleId: (0, pg_core_1.varchar)("bundle_id").notNull().references(() => exports.notesBundles.id, { onDelete: "cascade" }),
    buyerId: (0, pg_core_1.varchar)("buyer_id").notNull().references(() => exports.users.id, { onDelete: "cascade" }),
    paymentProof: (0, pg_core_1.text)("payment_proof").notNull(),
    paymentStatus: (0, exports.paymentStatusEnum)("payment_status").notNull().default("pending"),
    verifiedBy: (0, pg_core_1.varchar)("verified_by").references(() => exports.users.id),
    verifiedAt: (0, pg_core_1.timestamp)("verified_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").notNull().defaultNow(),
});
exports.bundlePurchasesRelations = (0, drizzle_orm_1.relations)(exports.bundlePurchases, ({ one }) => ({
    bundle: one(exports.notesBundles, {
        fields: [exports.bundlePurchases.bundleId],
        references: [exports.notesBundles.id],
    }),
    buyer: one(exports.users, {
        fields: [exports.bundlePurchases.buyerId],
        references: [exports.users.id],
    }),
    verifier: one(exports.users, {
        fields: [exports.bundlePurchases.verifiedBy],
        references: [exports.users.id],
    }),
}));
// Validation schemas (UPDATED)
exports.insertUserSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    name: zod_1.z.string().optional(),
    email: zod_1.z.string().email("Invalid email"),
    phone: zod_1.z.string().optional(),
    rollNumber: zod_1.z.string().optional(),
    semester: zod_1.z.number().optional(),
    college: zod_1.z.string().optional(),
    collegeId: zod_1.z.string().optional(),
    userType: zod_1.z.string().optional(),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
});
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "Username is required"),
    password: zod_1.z.string().min(1, "Password is required"),
});
exports.verifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, "Token is required"),
});
exports.resendVerificationSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email"),
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

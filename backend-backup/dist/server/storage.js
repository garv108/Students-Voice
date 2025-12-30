"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.DatabaseStorage = void 0;
const schema_1 = require("../shared/schema");
const db_1 = require("./db");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const util_1 = require("util");
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
async function hashPassword(password) {
    const salt = (0, crypto_1.randomBytes)(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64));
    return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
    const [hashedPassword, salt] = stored.split(".");
    const buf = (await scryptAsync(supplied, salt, 64));
    return buf.toString("hex") === hashedPassword;
}
class DatabaseStorage {
    async getUser(id) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id));
        return user || undefined;
    }
    async getUserByUsername(username) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.username, username));
        return user || undefined;
    }
    async getUserByEmail(email) {
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, email));
        return user || undefined;
    }
    async createUser(insertUser) {
        const hashedPassword = await hashPassword(insertUser.password);
        const [user] = await db_1.db
            .insert(schema_1.users)
            .values({ ...insertUser, password: hashedPassword })
            .returning();
        return user;
    }
    async validatePassword(username, password) {
        const user = await this.getUserByUsername(username);
        if (!user)
            return null;
        const isValid = await comparePasswords(password, user.password);
        return isValid ? user : null;
    }
    async updateUserBan(userId, bannedUntil) {
        await db_1.db.update(schema_1.users).set({ bannedUntil }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
    async updateUserRole(userId, role) {
        await db_1.db.update(schema_1.users).set({ role: role }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
    async getAllUsers() {
        return db_1.db.select().from(schema_1.users).orderBy((0, drizzle_orm_1.desc)(schema_1.users.createdAt));
    }
    async createComplaint(complaint) {
        const [created] = await db_1.db.insert(schema_1.complaints).values(complaint).returning();
        return created;
    }
    async getComplaint(id) {
        const [complaint] = await db_1.db.select().from(schema_1.complaints).where((0, drizzle_orm_1.eq)(schema_1.complaints.id, id));
        return complaint || undefined;
    }
    async getComplaints() {
        return db_1.db.select().from(schema_1.complaints).orderBy((0, drizzle_orm_1.desc)(schema_1.complaints.createdAt));
    }
    async getLeaderboardComplaints() {
        return db_1.db
            .select()
            .from(schema_1.complaints)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.complaints.similarComplaintsCount), (0, drizzle_orm_1.desc)(schema_1.complaints.likesCount), (0, drizzle_orm_1.desc)(schema_1.complaints.createdAt));
    }
    async updateComplaint(id, updates) {
        const [updated] = await db_1.db
            .update(schema_1.complaints)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.complaints.id, id))
            .returning();
        return updated || undefined;
    }
    async deleteComplaint(id) {
        const complaint = await this.getComplaint(id);
        const clusterId = complaint?.clusterId;
        await db_1.db.delete(schema_1.likes).where((0, drizzle_orm_1.eq)(schema_1.likes.complaintId, id));
        await db_1.db.delete(schema_1.reactions).where((0, drizzle_orm_1.eq)(schema_1.reactions.complaintId, id));
        await db_1.db.delete(schema_1.complaints).where((0, drizzle_orm_1.eq)(schema_1.complaints.id, id));
        if (clusterId) {
            await this.updateClusterCount(clusterId);
        }
    }
    async deleteComplaintsBulk(ids) {
        const clusterIds = new Set();
        for (const id of ids) {
            const complaint = await this.getComplaint(id);
            if (complaint?.clusterId) {
                clusterIds.add(complaint.clusterId);
            }
            await db_1.db.delete(schema_1.likes).where((0, drizzle_orm_1.eq)(schema_1.likes.complaintId, id));
            await db_1.db.delete(schema_1.reactions).where((0, drizzle_orm_1.eq)(schema_1.reactions.complaintId, id));
            await db_1.db.delete(schema_1.complaints).where((0, drizzle_orm_1.eq)(schema_1.complaints.id, id));
        }
        for (const clusterId of Array.from(clusterIds)) {
            await this.updateClusterCount(clusterId);
        }
    }
    async addLike(complaintId, userId, isLike) {
        const existing = await this.getUserLike(complaintId, userId);
        if (existing) {
            if (existing.isLike === isLike) {
                await db_1.db.delete(schema_1.likes).where((0, drizzle_orm_1.eq)(schema_1.likes.id, existing.id));
                await db_1.db.update(schema_1.complaints).set({
                    likesCount: isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.likesCount} - 1` : schema_1.complaints.likesCount,
                    dislikesCount: !isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.dislikesCount} - 1` : schema_1.complaints.dislikesCount,
                }).where((0, drizzle_orm_1.eq)(schema_1.complaints.id, complaintId));
            }
            else {
                await db_1.db.update(schema_1.likes).set({ isLike }).where((0, drizzle_orm_1.eq)(schema_1.likes.id, existing.id));
                await db_1.db.update(schema_1.complaints).set({
                    likesCount: isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.likesCount} + 1` : (0, drizzle_orm_1.sql) `${schema_1.complaints.likesCount} - 1`,
                    dislikesCount: !isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.dislikesCount} + 1` : (0, drizzle_orm_1.sql) `${schema_1.complaints.dislikesCount} - 1`,
                }).where((0, drizzle_orm_1.eq)(schema_1.complaints.id, complaintId));
            }
        }
        else {
            await db_1.db.insert(schema_1.likes).values({ complaintId, userId, isLike });
            await db_1.db.update(schema_1.complaints).set({
                likesCount: isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.likesCount} + 1` : schema_1.complaints.likesCount,
                dislikesCount: !isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.dislikesCount} + 1` : schema_1.complaints.dislikesCount,
            }).where((0, drizzle_orm_1.eq)(schema_1.complaints.id, complaintId));
        }
    }
    async removeLike(complaintId, userId) {
        const existing = await this.getUserLike(complaintId, userId);
        if (existing) {
            await db_1.db.delete(schema_1.likes).where((0, drizzle_orm_1.eq)(schema_1.likes.id, existing.id));
            await db_1.db.update(schema_1.complaints).set({
                likesCount: existing.isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.likesCount} - 1` : schema_1.complaints.likesCount,
                dislikesCount: !existing.isLike ? (0, drizzle_orm_1.sql) `${schema_1.complaints.dislikesCount} - 1` : schema_1.complaints.dislikesCount,
            }).where((0, drizzle_orm_1.eq)(schema_1.complaints.id, complaintId));
        }
    }
    async getUserLike(complaintId, userId) {
        const [like] = await db_1.db
            .select()
            .from(schema_1.likes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.likes.complaintId, complaintId), (0, drizzle_orm_1.eq)(schema_1.likes.userId, userId)));
        return like || undefined;
    }
    async addReaction(complaintId, userId, emoji) {
        const existing = await db_1.db
            .select()
            .from(schema_1.reactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reactions.complaintId, complaintId), (0, drizzle_orm_1.eq)(schema_1.reactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.reactions.emoji, emoji)));
        if (existing.length > 0) {
            await db_1.db.delete(schema_1.reactions).where((0, drizzle_orm_1.eq)(schema_1.reactions.id, existing[0].id));
        }
        else {
            await db_1.db.insert(schema_1.reactions).values({ complaintId, userId, emoji });
        }
    }
    async removeReaction(complaintId, userId, emoji) {
        await db_1.db
            .delete(schema_1.reactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reactions.complaintId, complaintId), (0, drizzle_orm_1.eq)(schema_1.reactions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.reactions.emoji, emoji)));
    }
    async getReactionCounts(complaintId) {
        const result = await db_1.db
            .select({
            emoji: schema_1.reactions.emoji,
            count: (0, drizzle_orm_1.count)(),
        })
            .from(schema_1.reactions)
            .where((0, drizzle_orm_1.eq)(schema_1.reactions.complaintId, complaintId))
            .groupBy(schema_1.reactions.emoji);
        return result.map((r) => ({ emoji: r.emoji, count: Number(r.count) }));
    }
    async getUserReactions(complaintId, userId) {
        const result = await db_1.db
            .select({ emoji: schema_1.reactions.emoji })
            .from(schema_1.reactions)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.reactions.complaintId, complaintId), (0, drizzle_orm_1.eq)(schema_1.reactions.userId, userId)));
        return result.map((r) => r.emoji);
    }
    async createAbuseLog(log) {
        const [created] = await db_1.db.insert(schema_1.abuseLogs).values(log).returning();
        return created;
    }
    async getAbuseLogs() {
        return db_1.db.select().from(schema_1.abuseLogs).orderBy((0, drizzle_orm_1.desc)(schema_1.abuseLogs.createdAt));
    }
    async getOrCreateCluster(keywords) {
        if (!keywords || keywords.length === 0)
            return null;
        const existingClusters = await db_1.db.select().from(schema_1.clusterGroups);
        for (const cluster of existingClusters) {
            if (cluster.keywords) {
                const clusterKeywords = cluster.keywords;
                const overlap = this.calculateKeywordOverlap(keywords, clusterKeywords);
                if (overlap >= 0.3) {
                    return cluster;
                }
            }
        }
        const [newCluster] = await db_1.db
            .insert(schema_1.clusterGroups)
            .values({
            keywords,
            problemCount: 1,
            urgency: "normal",
        })
            .returning();
        return newCluster;
    }
    calculateKeywordOverlap(keywords1, keywords2) {
        const set1 = new Set(keywords1.map(k => k.toLowerCase()));
        const set2 = new Set(keywords2.map(k => k.toLowerCase()));
        let overlap = 0;
        for (const keyword of Array.from(set1)) {
            if (set2.has(keyword))
                overlap++;
        }
        const totalUnique = new Set([...Array.from(set1), ...Array.from(set2)]).size;
        return totalUnique > 0 ? overlap / totalUnique : 0;
    }
    async updateClusterCount(clusterId) {
        const activeComplaintsInCluster = await db_1.db
            .select({ count: (0, drizzle_orm_1.count)() })
            .from(schema_1.complaints)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.complaints.clusterId, clusterId), (0, drizzle_orm_1.eq)(schema_1.complaints.solved, false)));
        const activeCount = Number(activeComplaintsInCluster[0]?.count || 0);
        const urgency = (0, schema_1.calculateUrgency)(activeCount);
        await db_1.db
            .update(schema_1.clusterGroups)
            .set({ problemCount: activeCount, urgency, lastUpdated: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.clusterGroups.id, clusterId));
        await db_1.db
            .update(schema_1.complaints)
            .set({ similarComplaintsCount: activeCount, urgency })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.complaints.clusterId, clusterId), (0, drizzle_orm_1.eq)(schema_1.complaints.solved, false)));
    }
    async recalculateUrgencies() {
        const allClusters = await db_1.db.select().from(schema_1.clusterGroups);
        for (const cluster of allClusters) {
            await this.updateClusterCount(cluster.id);
        }
    }
    async getAdminStats() {
        const allComplaints = await db_1.db.select().from(schema_1.complaints);
        const allUsers = await db_1.db.select().from(schema_1.users);
        const allAbuseLogs = await db_1.db.select().from(schema_1.abuseLogs);
        const now = new Date();
        return {
            totalComplaints: allComplaints.length,
            pendingComplaints: allComplaints.filter((c) => c.status === "pending").length,
            solvedComplaints: allComplaints.filter((c) => c.solved).length,
            urgentCount: allComplaints.filter((c) => c.urgency === "urgent").length,
            criticalCount: allComplaints.filter((c) => c.urgency === "critical" || c.urgency === "top_priority").length,
            emergencyCount: allComplaints.filter((c) => c.urgency === "emergency").length,
            totalUsers: allUsers.length,
            bannedUsers: allUsers.filter((u) => u.bannedUntil && new Date(u.bannedUntil) > now).length,
            abuseLogs: allAbuseLogs.length,
        };
    }
}
exports.DatabaseStorage = DatabaseStorage;
exports.storage = new DatabaseStorage();

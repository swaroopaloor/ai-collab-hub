import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { type Id } from "./_generated/dataModel";
import { STALE_MS } from "./presence";

/**
 * Every active session across the org (for the Radar dashboard).
 * Returns title, state, agentActivity, joinCode, participant count + names,
 * and whether the current user is a member.
 */
export const allSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);

    const result = [];
    for (const s of sessions) {
      const parts = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();

      const users = await Promise.all(
        parts.map((p) => ctx.db.get(p.userId)),
      );

      const participantNames = parts.map((p, i) => ({
        name:
          (users[i] as { name?: string; email?: string; isAnonymous?: boolean } | null)
            ?.name ??
          (users[i] as { name?: string; email?: string; isAnonymous?: boolean } | null)
            ?.email ??
          ((users[i] as { name?: string; email?: string; isAnonymous?: boolean } | null)
            ?.isAnonymous
            ? `Guest ${p.userId.slice(-4)}`
            : "Unknown"),
        role: p.role,
      }));

      let isMember = false;
      if (userId) {
        isMember = parts.some((p) => p.userId === userId);
      }

      result.push({
        _id: s._id,
        title: s.title,
        state: s.state,
        joinCode: s.joinCode,
        agentActivity: s.agentActivity ?? null,
        createdAt: s.createdAt,
        participantCount: parts.length,
        participantNames,
        isMember,
      });
    }
    return result;
  },
});

/**
 * All currently-live presence across every session (for the global presence bar).
 * Only returns presence rows within STALE_MS.
 */
export const allPresence = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_MS;
    const rows = await ctx.db.query("presence").collect();
    const live = rows.filter((r) => r.updatedAt > cutoff);

    // De-duplicate by userId (a user may have multiple tabs) and enrich with session title.
    const byUser = new Map<
      string,
      { sessionId: Id<"sessions">; sessionTitle: string; color: string; focus: string | null }
    >();
    for (const r of live) {
      if (!byUser.has(r.userId)) {
        const session = await ctx.db.get(r.sessionId);
        byUser.set(r.userId, {
          sessionId: r.sessionId,
          sessionTitle: session?.title ?? "unknown",
          color: r.color,
          focus: r.focus ?? null,
        });
      }
    }

    // Resolve user names for each unique user.
    const entries: Array<{
      userId: string;
      name: string;
      sessionId: Id<"sessions">;
      sessionTitle: string;
      color: string;
      focus: string | null;
    }> = [];
    for (const [userId, info] of byUser) {
      const user = await ctx.db.get(userId as Id<"users">);
      const u = user as { name?: string; email?: string; isAnonymous?: boolean } | null;
      entries.push({
        userId,
        name:
          u?.name ??
          u?.email ??
          (u?.isAnonymous ? `Guest ${userId.slice(-4)}` : "Unknown"),
        ...info,
      });
    }
    return entries;
  },
});

/**
 * Recent org-wide events across all sessions (for the activity feed).
 * Returns the N most recent events, enriched with session title.
 */
export const recentEvents = query({
  args: {},
  handler: async (ctx) => {
    // Scan events table ordered by _creationTime desc (Convex default ordering).
    const raw = await ctx.db.query("events").order("desc").take(60);

    const result = [];
    for (const e of raw) {
      const session = await ctx.db.get(e.sessionId);
      result.push({
        _id: e._id,
        sessionId: e.sessionId,
        sessionTitle: session?.title ?? "unknown",
        seq: e.seq,
        type: e.type,
        authorType: e.authorType,
        authorName: e.authorName,
        content: e.content,
        createdAt: e._creationTime,
      });
    }
    return result;
  },
});

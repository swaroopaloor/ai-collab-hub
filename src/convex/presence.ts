import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { COLORS } from "./sessions";

/** Ephemeral live presence for a session. Rows older than STALE_MS are ignored. */
export const STALE_MS = 10_000;

export const listPresence = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const cutoff = Date.now() - STALE_MS;
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    return rows
      .filter((r) => r.updatedAt > cutoff)
      .map((r) => ({
        tabId: r.tabId,
        name: r.name,
        color: r.color,
        cursorX: r.cursorX,
        cursorY: r.cursorY,
        focus: r.focus ?? null,
      }));
  },
});

function colorForSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export const heartbeat = mutation({
  args: {
    sessionId: v.id("sessions"),
    tabId: v.string(),
    cursorX: v.number(),
    cursorY: v.number(),
    focus: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, tabId, cursorX, cursorY, focus }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    const displayName =
      user?.name ?? user?.email ?? `Guest ${userId.slice(-4)}`;

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_session_tab", (q) =>
        q.eq("sessionId", sessionId).eq("tabId", tabId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        cursorX,
        cursorY,
        focus,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("presence", {
        sessionId,
        tabId,
        userId,
        name: displayName,
        color: colorForSeed(tabId),
        cursorX,
        cursorY,
        focus,
        updatedAt: Date.now(),
      });
    }
  },
});

export const leave = mutation({
  args: { sessionId: v.id("sessions"), tabId: v.string() },
  handler: async (ctx, { sessionId, tabId }) => {
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_session_tab", (q) =>
        q.eq("sessionId", sessionId).eq("tabId", tabId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/** Housekeeping: drop stale presence rows so the table stays small. */
export const cleanupStale = mutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STALE_MS * 6;
    const stale = await ctx.db
      .query("presence")
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .take(100);
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
  },
});

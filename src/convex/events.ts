import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { appendEvent } from "./sessions";

/** Ask the AI agent for a catch-up recap (used when joining a session in progress). */
export const requestSummary = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    await ctx.scheduler.runAfter(0, internal.agent.generateJoinSummary, {
      sessionId,
      forUserName:
        user?.name ?? user?.email ?? `Guest ${userId.slice(-4)}`,
    });
  },
});

const AGENT_MENTION = /@(claude|agent|ai)\b/i;

export const listEvents = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("events")
      .withIndex("by_session_seq", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .take(500);
  },
});

export const postMessage = mutation({
  args: {
    sessionId: v.id("sessions"),
    content: v.string(),
  },
  handler: async (ctx, { sessionId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const me = await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .first();
    if (!me) throw new Error("Not a participant of this session");
    if (me.role === "observer")
      throw new Error("Observers are read-only. Request control to post.");

    const user = await ctx.db.get(userId);
    const displayName =
      user?.name ?? user?.email ?? `Guest ${userId.slice(-4)}`;
    const trimmed = content.trim();
    if (!trimmed) return;

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");

    await appendEvent(ctx, sessionId, {
      type: "message",
      authorType: "human",
      authorId: userId,
      authorName: displayName,
      content: trimmed,
    });

    // @mention triggers an agent turn. If the agent is already mid-turn,
    // the running action picks this message up as a live interruption;
    // scheduling another turn here covers the race where the current one
    // just finished — the loop exits harmlessly if there is nothing pending.
    if (AGENT_MENTION.test(trimmed) && session.state !== "done" && session.state !== "paused") {
      await ctx.db.patch(sessionId, {
        state: "running",
        agentActivity: "AI is reading the thread...",
      });
      await ctx.scheduler.runAfter(0, internal.agent.runTurn, { sessionId });
    }
  },
});

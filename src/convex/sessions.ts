import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export const COLORS = [
  "#FF5C5C",
  "#FFD500",
  "#4DA6FF",
  "#2ECC71",
  "#B57BFF",
  "#FF9440",
  "#00C2C7",
];

function makeJoinCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function requireUserId(ctx: MutationCtx | QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

/** Append an event to the session's append-only timeline. */
export async function appendEvent(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  event: {
    type: Doc<"events">["type"];
    authorType: "human" | "agent" | "system";
    authorId?: Id<"users">;
    authorName: string;
    content: string;
    promptedBy?: string;
    toolName?: string;
    childSessionId?: Id<"sessions">;
  },
) {
  const last = await ctx.db
    .query("events")
    .withIndex("by_session_seq", (q) => q.eq("sessionId", sessionId))
    .order("desc")
    .first();
  const seq = (last?.seq ?? 0) + 1;
  await ctx.db.insert("events", { sessionId, seq, ...event });
}

// ---- Queries ----

export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50);
    const result = [];
    for (const s of sessions) {
      const participants = await ctx.db
        .query("participants")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();
      let isMember = false;
      if (userId) {
        const me = await ctx.db
          .query("participants")
          .withIndex("by_session_user", (q) =>
            q.eq("sessionId", s._id).eq("userId", userId),
          )
          .first();
        isMember = !!me;
      }
      result.push({
        _id: s._id,
        title: s.title,
        artifactType: s.artifactType,
        state: s.state,
        joinCode: s.joinCode,
        createdAt: s.createdAt,
        participantCount: participants.length,
        isMember,
      });
    }
    return result;
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    const parts = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const users = await Promise.all(parts.map((p) => ctx.db.get(p.userId)));
    return {
      _id: session._id,
      title: session.title,
      state: session.state,
      joinCode: session.joinCode,
      createdBy: session.createdBy,
      agentActivity: session.agentActivity,
      createdAt: session.createdAt,
      // Time travel lineage
      parentId: session.parentId,
      forkedAtSeq: session.forkedAtSeq,
      parentTitle: session.parentId
        ? (await ctx.db.get(session.parentId))?.title ?? null
        : null,
      participants: parts.map((p, i) => ({
        _id: p._id,
        userId: p.userId,
        role: p.role,
        name:
          users[i]?.name ??
          users[i]?.email ??
          (users[i]?.isAnonymous ? `Guest ${p.userId.slice(-4)}` : "Unknown"),
      })),
    };
  },
});

export const getSessionByCode = query({
  args: { joinCode: v.string() },
  handler: async (ctx, { joinCode }) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_joinCode", (q) =>
        q.eq("joinCode", joinCode.toUpperCase().trim()),
      )
      .first();
  },
});

export const myParticipant = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .first();
  },
});

// ---- Mutations ----

export const createSession = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      title: title.trim() || "Untitled session",
      artifactType: "chat",
      state: "awaiting_input",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now,
    });
    await ctx.db.insert("participants", {
      sessionId,
      userId,
      role: "driver",
      joinedAt: now,
    });
    await appendEvent(ctx, sessionId, {
      type: "system",
      authorType: "system",
      authorName: "System",
      content: `${user?.name ?? user?.email ?? "Someone"} created the session.`,
    });
    return sessionId;
  },
});

export const joinSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("driver"),
      v.literal("copilot"),
      v.literal("observer"),
    ),
  },
  handler: async (ctx, { sessionId, role }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    const user = await ctx.db.get(userId);

    const existing = await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .first();

    const displayName =
      user?.name ?? user?.email ?? `Guest ${userId.slice(-4)}`;

    if (existing) return existing._id;

    await ctx.db.insert("participants", {
      sessionId,
      userId,
      role,
      joinedAt: Date.now(),
    });

    await appendEvent(ctx, sessionId, {
      type: "system",
      authorType: "system",
      authorName: "System",
      content: `${displayName} joined as ${role}.`,
    });
    return null;
  },
});

export const setMyRole = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("driver"),
      v.literal("copilot"),
      v.literal("observer"),
    ),
  },
  handler: async (ctx, { sessionId, role }) => {
    const userId = await requireUserId(ctx);
    const me = await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .first();
    if (!me) throw new Error("Not a participant");
    const user = await ctx.db.get(userId);
    const displayName = user?.name ?? user?.email ?? "Someone";

    if (me.role === "observer" && role !== "observer") {
      await appendEvent(ctx, sessionId, {
        type: "intervention",
        authorType: "human",
        authorId: userId,
        authorName: displayName,
        content: `${displayName} requested control and became ${
          role === "driver" ? "driver" : "co-pilot"
        }.`,
      });
    }
    await ctx.db.patch(me._id, { role });
  },
});

export const setSessionState = mutation({
  args: {
    sessionId: v.id("sessions"),
    state: v.union(
      v.literal("running"),
      v.literal("paused"),
      v.literal("awaiting_input"),
      v.literal("done"),
    ),
  },
  handler: async (ctx, { sessionId, state }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    await ctx.db.patch(sessionId, {
      state,
      ...(state === "paused" ? { agentActivity: undefined } : {}),
    });
    const user = await ctx.db.get(userId);
    await appendEvent(ctx, sessionId, {
      type: "system",
      authorType: "human",
      authorId: userId,
      authorName: user?.name ?? user?.email ?? "Someone",
      content:
        state === "paused"
          ? `paused the agent.`
          : state === "running"
            ? `resumed the agent.`
            : state === "done"
              ? `marked the session done.`
              : `set the session to awaiting input.`,
    });
  },
});

// ---- Time travel: fork a session at any timeline position ----

/** Create a full copy of the session up to `uptoSeq` (inclusive), with all
 *  copied events keeping their original sequence numbers so the fork can be
 *  scrubbed identically. A fresh agent run is kicked off from that point.
 *  The original session is untouched except for a branch-marker event. */
export const forkSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    uptoSeq: v.number(),
  },
  handler: async (ctx, { sessionId, uptoSeq }) => {
    const userId = await requireUserId(ctx);
    const parent = await ctx.db.get(sessionId);
    if (!parent) throw new Error("Session not found");
    const me = await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .first();
    if (!me) throw new Error("Only participants can fork this session");

    const last = await ctx.db
      .query("events")
      .withIndex("by_session_seq", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .first();
    if (!last || uptoSeq < 1 || uptoSeq > last.seq)
      throw new Error("Invalid timeline position");

    const user = await ctx.db.get(userId);
    const now = Date.now();

    // 1. The child session, pointing back at its origin.
    const childId = await ctx.db.insert("sessions", {
      title: `${parent.title} (fork)`,
      artifactType: parent.artifactType,
      state: "running",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now,
      parentId: sessionId,
      forkedAtSeq: uptoSeq,
    });

    // 2. Full state copy: participants keep their roles.
    const parts = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const p of parts) {
      await ctx.db.insert("participants", {
        sessionId: childId,
        userId: p.userId,
        role: p.userId === userId && p.role === "observer" ? "copilot" : p.role,
        joinedAt: now,
      });
    }

    // 3. Copy the timeline up to the fork point, preserving seq order.
    const history = await ctx.db
      .query("events")
      .withIndex("by_session_seq", (q) => q.eq("sessionId", sessionId))
      .take(uptoSeq); // by_session_seq is ordered by seq ascending
    for (const e of history) {
      await ctx.db.insert("events", {
        sessionId: childId,
        seq: e.seq,
        type: e.type,
        authorType: e.authorType,
        authorId: e.authorId,
        authorName: e.authorName,
        content: e.content,
        promptedBy: e.promptedBy,
        toolName: e.toolName,
      });
    }

    await appendEvent(ctx, childId, {
      type: "system",
      authorType: "system",
      authorName: "System",
      content: `⑂ ${user?.name ?? user?.email ?? "Someone"} forked this session from "${parent.title}" at timeline position ${uptoSeq}. A fresh agent run starts here.`,
    });

    // 4. Branch indicator in the parent's timeline.
    await appendEvent(ctx, sessionId, {
      type: "fork",
      authorType: "human",
      authorId: userId,
      authorName: user?.name ?? user?.email ?? "Someone",
      content: `forked this session from here`,
      childSessionId: childId,
    });

    // 5. Fresh agent run from the fork point. The turn loop reads the copied
    //    thread, so the agent resumes with full context but no stale state.
    await ctx.scheduler.runAfter(0, internal.agent.runTurn, {
      sessionId: childId,
    });

    return childId;
  },
});

// ---- Internal helpers used by the agent action ----

export const internalSetActivity = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    label: v.optional(v.string()),
    state: v.optional(
      v.union(
        v.literal("running"),
        v.literal("paused"),
        v.literal("awaiting_input"),
        v.literal("done"),
      ),
    ),
  },
  handler: async (ctx, { sessionId, label, state }) => {
    const patch: Record<string, unknown> = {};
    if (label !== undefined) patch.agentActivity = label;
    if (state !== undefined) patch.state = state;
    if (Object.keys(patch).length > 0)
      await ctx.db.patch(sessionId, patch as never);
  },
});

export const internalAppendEvent = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    type: v.union(
      v.literal("message"),
      v.literal("agent_message"),
      v.literal("agent_tool_call"),
      v.literal("intervention"),
      v.literal("system"),
      v.literal("summary"),
      v.literal("fork"),
      v.literal("proposal"),
      v.literal("gate_decision"),
    ),
    authorType: v.union(
      v.literal("human"),
      v.literal("agent"),
      v.literal("system"),
    ),
    authorName: v.string(),
    content: v.string(),
    promptedBy: v.optional(v.string()),
    toolName: v.optional(v.string()),
    childSessionId: v.optional(v.id("sessions")),
  },
  handler: async (ctx, { sessionId, ...event }) => {
    await appendEvent(ctx, sessionId, event);
  },
});

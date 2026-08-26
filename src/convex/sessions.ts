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

export function makeJoinCode(): string {
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
  // Track last activity for autonomous mode and away-briefing detection.
  await ctx.db.patch(sessionId, { lastActivityAt: Date.now() } as never);
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
      // Autonomous operation
      autonomousScope: session.autonomousScope ?? null,
      lastActivityAt: session.lastActivityAt ?? session.createdAt,
      handoffCount: session.handoffCount,
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
      handoffCount: 0,
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
      handoffCount: 0,
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

// ---- Handoff ----

export const handoffSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    toUserId: v.id("users"),
    note: v.string(),
  },
  handler: async (ctx, { sessionId, toUserId, note }) => {
    const userId = await requireUserId(ctx);
    const me = await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .first();
    if (!me || me.role !== "driver")
      throw new Error("Only drivers can hand off");

    const user = await ctx.db.get(userId);
    const toUser = await ctx.db.get(toUserId);
    const fromName = user?.name ?? user?.email ?? "Someone";
    const toName = toUser?.name ?? toUser?.email ?? "someone";

    // Add receiver as driver if not already a participant.
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", toUserId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { role: "driver" });
    } else {
      await ctx.db.insert("participants", {
        sessionId,
        userId: toUserId,
        role: "driver",
        joinedAt: Date.now(),
      });
    }

    // Downgrade the handoff-er to co-pilot.
    await ctx.db.patch(me._id, { role: "copilot" });

    // Increment handoff counter.
    const session = await ctx.db.get(sessionId);
    await ctx.db.patch(sessionId, {
      handoffCount: (session?.handoffCount ?? 0) + 1,
    } as never);

    await appendEvent(ctx, sessionId, {
      type: "intervention",
      authorType: "human",
      authorId: userId,
      authorName: fromName,
      content: `handed off to ${toName}: "${note}"`,
    });
  },
});

// ---- Autonomous scope ----

export const setAutonomousScope = mutation({
  args: {
    sessionId: v.id("sessions"),
    scope: v.string(), // "full" | "research_only" | "off"
  },
  handler: async (ctx, { sessionId, scope }) => {
    const userId = await requireUserId(ctx);
    const me = await ctx.db
      .query("participants")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .first();
    if (!me || (me.role !== "driver" && me.role !== "copilot"))
      throw new Error("Only drivers or co-pilots can set autonomous scope");

    await ctx.db.patch(sessionId, { autonomousScope: scope } as never);
    const user = await ctx.db.get(userId);
    await appendEvent(ctx, sessionId, {
      type: "system",
      authorType: "human",
      authorId: userId,
      authorName: user?.name ?? user?.email ?? "Someone",
      content: `set autonomous mode to "${scope}"`,
    });
  },
});

// ---- Away briefing ----

/** Generate a briefing of what happened since the user was last active. */
export const getAwayBriefing = query({
  args: {
    sessionId: v.id("sessions"),
    lastSeenAt: v.number(),
  },
  handler: async (ctx, { sessionId, lastSeenAt }) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_session_seq", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .take(500);

    // Events after the user's last activity
    const newEvents = events.filter((e) => e.seq > 0); // all events
    const recentEvents = newEvents.filter((e) => {
      const creationTime = e._creationTime;
      return creationTime > lastSeenAt;
    });

    if (recentEvents.length === 0) return null;

    const agentActions = recentEvents.filter(
      (e) => e.authorType === "agent",
    );
    const humanActions = recentEvents.filter(
      (e) => e.authorType === "human",
    );
    const proposals = recentEvents.filter((e) => e.type === "proposal");
    const decisions = recentEvents.filter((e) => e.type === "gate_decision");

    const summaryParts: string[] = [];
    if (agentActions.length > 0) {
      summaryParts.push(
        `Agent made ${agentActions.length} action(s): ${agentActions
          .slice(0, 3)
          .map((e) => e.content.slice(0, 60))
          .join("; ")}`,
      );
    }
    if (proposals.length > 0) {
      summaryParts.push(`${proposals.length} change(s) proposed awaiting review`);
    }
    if (decisions.length > 0) {
      summaryParts.push(`${decisions.length} review decision(s) made`);
    }
    if (humanActions.length > 0) {
      summaryParts.push(
        `${humanActions.length} human interaction(s) while you were away`,
      );
    }

    return {
      eventCount: recentEvents.length,
      summary: summaryParts.join(". "),
      hasPendingProposals: proposals.some((_, i) => {
        const gate = recentEvents.find(
          (e) =>
            e.type === "gate_decision" &&
            e.content.includes(recentEvents[i]?.content ?? ""),
        );
        return !gate;
      }),
    };
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

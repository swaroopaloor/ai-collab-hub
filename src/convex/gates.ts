import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { appendEvent } from "./sessions";
import type { Id } from "./_generated/dataModel";

/** List all gates for a session (newest first). */
export const listGates = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("approvalGates")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .collect();
  },
});

/** Single gate by ID. */
export const getGate = query({
  args: { gateId: v.id("approvalGates") },
  handler: async (ctx, { gateId }) => {
    return await ctx.db.get(gateId);
  },
});

/** Pending gates for a session (agent is paused waiting). */
export const pendingGates = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("approvalGates")
      .withIndex("by_session_status", (q) =>
        q.eq("sessionId", sessionId).eq("status", "pending"),
      )
      .order("desc")
      .collect();
  },
});

// ---- Mutations (public, for reviewers) ----

function requireUser() {
  return getAuthUserId;
}

export const approveGate = mutation({
  args: {
    gateId: v.id("approvalGates"),
    editedContent: v.optional(v.string()),
  },
  handler: async (ctx, { gateId, editedContent }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    const gate = await ctx.db.get(gateId);
    if (!gate) throw new Error("Gate not found");
    if (gate.status !== "pending") throw new Error("Gate already decided");

    const reviewerName =
      user?.name ?? user?.email ?? `Guest ${userId.slice(-4)}`;
    const finalContent = editedContent ?? gate.afterContent;
    const wasEdited = editedContent && editedContent !== gate.afterContent;

    await ctx.db.patch(gateId, {
      status: wasEdited ? "edited" : "approved",
      editedContent: wasEdited ? editedContent : undefined,
      decidedAt: Date.now(),
      decidedBy: reviewerName,
    });

    await appendEvent(ctx, gate.sessionId, {
      type: "gate_decision",
      authorType: "human",
      authorId: userId,
      authorName: reviewerName,
      content: wasEdited
        ? `edited and approved the proposed change: "${gate.title}"`
        : `approved the proposed change: "${gate.title}"`,
      promptedBy: reviewerName,
    });
  },
});

export const rejectGate = mutation({
  args: {
    gateId: v.id("approvalGates"),
    comment: v.string(),
  },
  handler: async (ctx, { gateId, comment }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    const gate = await ctx.db.get(gateId);
    if (!gate) throw new Error("Gate not found");
    if (gate.status !== "pending") throw new Error("Gate already decided");

    const reviewerName =
      user?.name ?? user?.email ?? `Guest ${userId.slice(-4)}`;

    await ctx.db.patch(gateId, {
      status: "rejected",
      comment,
      decidedAt: Date.now(),
      decidedBy: reviewerName,
    });

    await appendEvent(ctx, gate.sessionId, {
      type: "gate_decision",
      authorType: "human",
      authorId: userId,
      authorName: reviewerName,
      content: `rejected the proposed change "${gate.title}": ${comment}`,
      promptedBy: reviewerName,
    });
  },
});

// ---- Internal mutation: agent creates a gate ----

export const createGate = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    eventId: v.id("events"),
    artifactType: v.string(),
    title: v.string(),
    beforeContent: v.string(),
    afterContent: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const gateId = await ctx.db.insert("approvalGates", {
      sessionId: args.sessionId,
      eventId: args.eventId,
      status: "pending",
      artifactType: args.artifactType,
      title: args.title,
      beforeContent: args.beforeContent,
      afterContent: args.afterContent,
      createdBy: args.createdBy,
      createdAt: now,
    });

    await appendEvent(ctx, args.sessionId, {
      type: "proposal",
      authorType: "agent",
      authorName: args.createdBy,
      content: `proposed a change: "${args.title}" — awaiting review`,
    });

    await ctx.db.patch(args.sessionId, {
      state: "paused",
      agentActivity: `awaiting review: ${args.title}`,
    });

    return gateId;
  },
});

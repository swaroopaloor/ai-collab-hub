import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { appendEvent } from "./sessions";

/** List all memory entries, newest first. Optional tag filter. */
export const listMemory = query({
  args: {
    tag: v.optional(v.string()),
  },
  handler: async (ctx, { tag }) => {
    let q = ctx.db
      .query("teamMemory")
      .withIndex("by_createdAt")
      .order("desc");

    const all = await q.take(200);

    if (tag) {
      return all.filter((m) =>
        m.tags.some((t) => t.includes(tag)),
      );
    }
    return all;
  },
});

/** Search memory entries by free text across content and tags. */
export const searchMemory = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    const lower = q.toLowerCase();
    const all = await ctx.db
      .query("teamMemory")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    return all.filter(
      (m) =>
        m.content.toLowerCase().includes(lower) ||
        m.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  },
});

/** Get memory entries relevant to a set of tags (used by agent at session start). */
export const relevantMemory = query({
  args: { tags: v.array(v.string()) },
  handler: async (ctx, { tags }) => {
    if (tags.length === 0) return [];
    const all = await ctx.db
      .query("teamMemory")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    return all.filter((m) =>
      m.tags.some((mt) => tags.some((qt) => mt.includes(qt) || qt.includes(mt))),
    );
  },
});

/** Create a memory entry (used by agent and humans). */
export const createMemory = mutation({
  args: {
    content: v.string(),
    sourceSessionId: v.id("sessions"),
    sourceSessionTitle: v.string(),
    tags: v.array(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const memoryId = await ctx.db.insert("teamMemory", {
      content: args.content,
      sourceSessionId: args.sourceSessionId,
      sourceSessionTitle: args.sourceSessionTitle,
      tags: args.tags,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await appendEvent(ctx, args.sourceSessionId, {
      type: "system",
      authorType: "agent",
      authorName: args.createdBy,
      content: `saved to Team Memory: "${args.content.slice(0, 80)}" [${args.tags.join(", ")}]`,
    });

    return memoryId;
  },
});

/** Update a memory entry (human editing). */
export const updateMemory = mutation({
  args: {
    memoryId: v.id("teamMemory"),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { memoryId, content, tags }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (content !== undefined) patch.content = content;
    if (tags !== undefined) patch.tags = tags;
    await ctx.db.patch(memoryId, patch as never);
  },
});

/** Delete a memory entry. */
export const deleteMemory = mutation({
  args: { memoryId: v.id("teamMemory") },
  handler: async (ctx, { memoryId }) => {
    await ctx.db.delete(memoryId);
  },
});

// ---- Internal: agent writes a memory ----

export const agentSaveMemory = internalMutation({
  args: {
    content: v.string(),
    sourceSessionId: v.id("sessions"),
    sourceSessionTitle: v.string(),
    tags: v.array(v.string()),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("teamMemory", {
      content: args.content,
      sourceSessionId: args.sourceSessionId,
      sourceSessionTitle: args.sourceSessionTitle,
      tags: args.tags,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await appendEvent(ctx, args.sourceSessionId, {
      type: "system",
      authorType: "agent",
      authorName: args.createdBy,
      content: `saved to Team Memory: "${args.content.slice(0, 80)}" [${args.tags.join(", ")}]`,
    });
  },
});

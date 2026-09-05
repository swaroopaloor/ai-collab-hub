import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

/** List all knowledge base entries, newest first. */
export const listKnowledgeBases = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("knowledgeBases")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);
  },
});

/** Search knowledge base entries by free text across title, content, and tags. */
export const searchKnowledgeBases = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    const lower = q.toLowerCase();
    const all = await ctx.db
      .query("knowledgeBases")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);

    return all.filter(
      (kb) =>
        kb.title.toLowerCase().includes(lower) ||
        kb.content.toLowerCase().includes(lower) ||
        kb.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  },
});

/** Create a knowledge base entry. */
export const createKnowledgeBase = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("knowledgeBases", {
      title: args.title,
      content: args.content,
      tags: args.tags,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update a knowledge base entry. */
export const updateKnowledgeBase = mutation({
  args: {
    kbId: v.id("knowledgeBases"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { kbId, title, content, tags }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (title !== undefined) patch.title = title;
    if (content !== undefined) patch.content = content;
    if (tags !== undefined) patch.tags = tags;
    await ctx.db.patch(kbId, patch as never);
  },
});

/** Delete a knowledge base entry. */
export const deleteKnowledgeBase = mutation({
  args: { kbId: v.id("knowledgeBases") },
  handler: async (ctx, { kbId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.delete(kbId);
  },
});

// ---- Internal: agent searches the knowledge base ----

export const internalSearchKnowledgeBases = query({
  args: { query: v.string() },
  handler: async (ctx, { query: q }) => {
    const lower = q.toLowerCase();
    const all = await ctx.db
      .query("knowledgeBases")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);

    return all
      .filter(
        (kb) =>
          kb.title.toLowerCase().includes(lower) ||
          kb.content.toLowerCase().includes(lower) ||
          kb.tags.some((t) => t.toLowerCase().includes(lower)),
      )
      .slice(0, 5) // Return top 5 most relevant
      .map((kb) => ({
        title: kb.title,
        excerpt: kb.content.slice(0, 300),
        tags: kb.tags,
      }));
  },
});

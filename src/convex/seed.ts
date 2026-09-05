import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { makeJoinCode } from "./sessions";

const AGENT_NAME = "AI";

/** Seed demo data if the user has no sessions yet. Idempotent. */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Only seed if user has no sessions.
    const allParticipants = await ctx.db.query("participants").take(200);
    if (allParticipants.some((p) => p.userId === userId)) return false; // already seeded

    const user = await ctx.db.get(userId);
    const name = user?.name ?? user?.email ?? "Demo User";
    const now = Date.now();
    const DAY = 86400000;
    const HOUR = 3600000;

    // Helper to insert events with proper seq ordering.
    async function addEvent(
      sessionId: Id<"sessions">,
      seq: number,
      event: {
        type: "message" | "agent_message" | "agent_tool_call" | "intervention" | "system" | "summary" | "fork" | "proposal" | "gate_decision";
        authorType: "human" | "agent" | "system";
        authorName: string;
        content: string;
        promptedBy?: string;
        toolName?: string;
        createdAt?: number;
      },
    ) {
      await ctx.db.insert("events", {
        sessionId,
        seq,
        ...event,
      });
    }

    // ---- Session 1: Support War Room (running, 2 days old, handoff happened) ----
    const s1 = await ctx.db.insert("sessions", {
      title: "Acme Corp Refund Escalation",
      artifactType: "chat",
      state: "running",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now - 2 * DAY,
      agentActivity: "researching refund policy",
      autonomousScope: "research_only",
      lastActivityAt: now - 300000,
      handoffCount: 1,
    });

    await ctx.db.insert("participants", {
      sessionId: s1, userId, role: "copilot", joinedAt: now - 2 * DAY,
    });

    // Simulate a second user (creates a fake user entry for demo).
    const fakeUser1 = await ctx.db.insert("users", {
      name: "Sarah Chen",
      email: "sarah@demo.com",
      isAnonymous: false,
    });
    await ctx.db.insert("participants", {
      sessionId: s1, userId: fakeUser1, role: "driver", joinedAt: now - DAY,
    });

    const s1Events = [
      { type: "system" as const, authorType: "system" as const, authorName: "System", content: `${name} created the session.` },
      { type: "message" as const, authorType: "human" as const, authorName: name, content: "@AI can you look into the Acme Corp refund request? They're on the Team annual plan." },
      { type: "agent_tool_call" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Looking up Acme Corp customer record → lookup_customer_record(\"acme corp\")", toolName: "lookup_customer_record", promptedBy: name },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Found Acme Corp — Team (annual) plan since Nov 2024, priority support, 2 past escalations. I'll search our refund policy.", promptedBy: name },
      { type: "agent_tool_call" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Searching KB for refund policy → search_knowledge_base(\"refund policy\")", toolName: "search_knowledge_base", promptedBy: name },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Our policy allows full refunds within 30 days for Team plans. Acme is well within that window. I recommend approving the refund and sending a retention offer.", promptedBy: name },
      { type: "intervention" as const, authorType: "human" as const, authorName: "Sarah Chen", content: "handed off to Sarah Chen: \"Taking over from PST timezone — will follow up with Acme\"" },
      { type: "message" as const, authorType: "human" as const, authorName: "Sarah Chen", content: "Good analysis. @AI can you also draft a retention email offering them a discount to stay?" },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Drafting a retention email with a 20% discount offer for their next renewal cycle. I'll save this customer context to Team Memory for future sessions.", promptedBy: "Sarah Chen" },
      { type: "system" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "saved to Team Memory: \"Acme Corp is on Team (annual) since Nov 2024. Priority support customer with 2 past escalations.\" [customer:acme-corp, topic:support]" },
    ];
    for (let i = 0; i < s1Events.length; i++) {
      await addEvent(s1, i + 1, { ...s1Events[i], createdAt: now - 2 * DAY + (i + 1) * 600000 });
    }

    // ---- Session 2: Coding session with pending approval gate ----
    const s2 = await ctx.db.insert("sessions", {
      title: "Billing API Rate Limit Fix",
      artifactType: "chat",
      state: "paused",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now - DAY,
      agentActivity: "awaiting review: increase rate limit",
      lastActivityAt: now - 1800000,
      handoffCount: 0,
    });

    await ctx.db.insert("participants", {
      sessionId: s2, userId, role: "driver", joinedAt: now - DAY,
    });

    const fakeUser2 = await ctx.db.insert("users", {
      name: "Marcus Webb",
      email: "marcus@demo.com",
      isAnonymous: false,
    });
    await ctx.db.insert("participants", {
      sessionId: s2, userId: fakeUser2, role: "copilot", joinedAt: now - DAY + HOUR,
    });

    const s2Events = [
      { type: "system" as const, authorType: "system" as const, authorName: "System", content: `${name} created the session.` },
      { type: "message" as const, authorType: "human" as const, authorName: name, content: "@AI the billing API is hitting rate limits for enterprise clients. Can you propose a fix?" },
      { type: "agent_tool_call" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Searching KB for rate limit docs → search_knowledge_base(\"billing API rate limit\")", toolName: "search_knowledge_base", promptedBy: name },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Found it — the current limit is 100 req/min per org. Enterprise SLA requires 500. I'll propose increasing the limit and adding a tier-based config.", promptedBy: name },
      { type: "proposal" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "proposed: \"increase rate limit\" — awaiting review", promptedBy: name },
    ];
    for (let i = 0; i < s2Events.length; i++) {
      await addEvent(s2, i + 1, { ...s2Events[i], createdAt: now - DAY + (i + 1) * 900000 });
    }

    // Create the approval gate for s2.
    const proposalEvent = await ctx.db
      .query("events")
      .withIndex("by_session_seq", (q) => q.eq("sessionId", s2))
      .order("desc")
      .first();

    await ctx.db.insert("approvalGates", {
      sessionId: s2,
      eventId: proposalEvent!._id,
      status: "pending",
      artifactType: "code",
      title: "Increase billing API rate limit from 100 to 500 req/min",
      beforeContent: `// billing-api/config.ts\nexport const RATE_LIMITS = {\n  free: 20,\n  team: 100,    // per org per minute\n  enterprise: 100, // should be 500 per SLA\n};`,
      afterContent: `// billing-api/config.ts\nexport const RATE_LIMITS = {\n  free: 20,\n  team: 100,\n  enterprise: 500, // updated per enterprise SLA\n};\n\n// Add tier lookup from org subscription\nexport function getRateLimit(tier: string): number {\n  return RATE_LIMITS[tier as keyof typeof RATE_LIMITS] ?? 20;\n}`,
      createdBy: AGENT_NAME,
      createdAt: now - DAY + 5 * 900000,
    });

    // ---- Session 3: Forked session with lineage ----
    const s3_parent = await ctx.db.insert("sessions", {
      title: "Q3 Planning Brainstorm",
      artifactType: "chat",
      state: "done",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now - 5 * DAY,
      lastActivityAt: now - 3 * DAY,
      handoffCount: 0,
    });

    await ctx.db.insert("participants", {
      sessionId: s3_parent, userId, role: "driver", joinedAt: now - 5 * DAY,
    });

    const s3_parentEvents = [
      { type: "system" as const, authorType: "system" as const, authorName: "System", content: `${name} created the session.` },
      { type: "message" as const, authorType: "human" as const, authorName: name, content: "@AI let's brainstorm Q3 priorities. What worked in Q2?" },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "In Q2, the team shipped 3 major features. The highest-impact was the real-time collaboration engine. I'd suggest doubling down on multiplayer experiences.", promptedBy: name },
      { type: "message" as const, authorType: "human" as const, authorName: name, content: "Agreed. What about expanding to support war rooms?" },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Support war rooms are a great fit — the same session abstraction works. I'd prototype it with a ticket resolution artifact.", promptedBy: name },
      { type: "fork" as const, authorType: "human" as const, authorName: name, content: "forked this session from here", childSessionId: undefined as never },
    ];
    for (let i = 0; i < s3_parentEvents.length; i++) {
      const ev = s3_parentEvents[i];
      const extra = ev.type === "fork" ? { childSessionId: undefined as unknown as Id<"sessions"> } : {};
      await addEvent(s3_parent, i + 1, { ...ev, ...extra, createdAt: now - 5 * DAY + (i + 1) * 1800000 });
    }

    // The fork child
    const s3 = await ctx.db.insert("sessions", {
      title: "Q3 Planning Brainstorm (fork)",
      artifactType: "chat",
      state: "running",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now - 3 * DAY,
      parentId: s3_parent,
      forkedAtSeq: 4,
      agentActivity: "analyzing market trends",
      autonomousScope: "full",
      lastActivityAt: now - 600000,
      handoffCount: 2,
    });

    await ctx.db.insert("participants", {
      sessionId: s3, userId, role: "copilot", joinedAt: now - 3 * DAY,
    });

    const fakeUser3 = await ctx.db.insert("users", {
      name: "Priya Kapoor",
      email: "priya@demo.com",
      isAnonymous: false,
    });
    await ctx.db.insert("participants", {
      sessionId: s3, userId: fakeUser3, role: "driver", joinedAt: now - 2 * DAY,
    });

    const s3Events = [
      { type: "system" as const, authorType: "system" as const, authorName: "System", content: `${name} forked this session from "Q3 Planning Brainstorm" at timeline position 4. A fresh agent run starts here.` },
      { type: "message" as const, authorType: "human" as const, authorName: name, content: "Let's focus the fork on the support war room idea specifically." },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "I'll research how support teams typically structure their war rooms and propose an artifact schema.", promptedBy: name },
      { type: "agent_tool_call" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Searching KB for support workflows → search_knowledge_base(\"support war room\")", toolName: "search_knowledge_base", promptedBy: name },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Based on industry patterns, a support war room needs: ticket title/status, live session with the agent, and a queue view. The agent should resolve tickets using KB search tools.", promptedBy: name },
      { type: "intervention" as const, authorType: "human" as const, authorName: "Priya Kapoor", content: "handed off to Priya Kapoor: \"Continuing from IST timezone — agent is researching, will check in 8 hours\"" },
      { type: "system" as const, authorType: "system" as const, authorName: "System", content: `${name} set autonomous mode to "full"` },
    ];
    for (let i = 0; i < s3Events.length; i++) {
      await addEvent(s3, i + 1, { ...s3Events[i], createdAt: now - 3 * DAY + (i + 1) * 2400000 });
    }

    // Update parent session's fork event with child ID.
    const parentForkEvent = await ctx.db
      .query("events")
      .withIndex("by_session_seq", (q) => q.eq("sessionId", s3_parent).eq("seq", 6))
      .first();
    if (parentForkEvent) {
      await ctx.db.patch(parentForkEvent._id, { childSessionId: s3 });
    }

    // ---- Session 4: Team Memory demo session (running, citations visible) ----
    const s4 = await ctx.db.insert("sessions", {
      title: "Acme Corp Onboarding Review",
      artifactType: "chat",
      state: "running",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now - HOUR * 3,
      agentActivity: "preparing onboarding checklist",
      lastActivityAt: now - 120000,
      handoffCount: 0,
    });

    await ctx.db.insert("participants", {
      sessionId: s4, userId, role: "driver", joinedAt: now - HOUR * 3,
    });

    const s4Events = [
      { type: "system" as const, authorType: "system" as const, authorName: "System", content: `${name} created the session.` },
      { type: "summary" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Catch-up on \"Acme Corp Onboarding Review\": your AI agent recalled from Team Memory that Acme Corp is on Team (annual) since Nov 2024, priority support customer. Preparing their onboarding checklist based on past interactions." },
      { type: "message" as const, authorType: "human" as const, authorName: name, content: "@AI what do we already know about Acme Corp?" },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "From Team Memory (sourced from Session \"Acme Corp Refund Escalation\"): Acme Corp is on the Team annual plan since Nov 2024. They're a priority support customer with 2 past escalations. They had a refund request recently that we handled with a retention offer. I'll use this context to prepare their onboarding checklist.", promptedBy: name },
    ];
    for (let i = 0; i < s4Events.length; i++) {
      await addEvent(s4, i + 1, { ...s4Events[i], createdAt: now - HOUR * 3 + (i + 1) * 600000 });
    }

    // ---- Session 5: Paused awaiting input (recent) ----
    const s5 = await ctx.db.insert("sessions", {
      title: "Feature Spec: Notification Preferences",
      artifactType: "chat",
      state: "awaiting_input",
      joinCode: makeJoinCode(),
      createdBy: userId,
      createdAt: now - HOUR * 6,
      lastActivityAt: now - HOUR * 2,
      handoffCount: 0,
    });

    await ctx.db.insert("participants", {
      sessionId: s5, userId, role: "driver", joinedAt: now - HOUR * 6,
    });

    const s5Events = [
      { type: "system" as const, authorType: "system" as const, authorName: "System", content: `${name} created the session.` },
      { type: "message" as const, authorType: "human" as const, authorName: name, content: "@AI draft a feature spec for notification preferences" },
      { type: "agent_message" as const, authorType: "agent" as const, authorName: AGENT_NAME, content: "Here's a draft spec: Users should be able to configure per-channel notification preferences (email, in-app, push). Settings should be accessible from the profile page with sensible defaults. Want me to expand any section?", promptedBy: name },
    ];
    for (let i = 0; i < s5Events.length; i++) {
      await addEvent(s5, i + 1, { ...s5Events[i], createdAt: now - HOUR * 6 + (i + 1) * 1200000 });
    }

    // ---- Team Memory entries ----
    await ctx.db.insert("teamMemory", {
      content: "Acme Corp is on Team (annual) since Nov 2024. Priority support customer with 2 past escalations. Currently has 1 open ticket. Treat all issues as high priority.",
      sourceSessionId: s1,
      sourceSessionTitle: "Acme Corp Refund Escalation",
      tags: ["customer:acme-corp", "topic:support"],
      createdBy: AGENT_NAME,
      createdAt: now - DAY + 6 * 600000,
      updatedAt: now - DAY + 6 * 600000,
    });

    await ctx.db.insert("teamMemory", {
      content: "Acme Corp prefers email over phone for billing disputes. They respond faster to written proposals.",
      sourceSessionId: s1,
      sourceSessionTitle: "Acme Corp Refund Escalation",
      tags: ["customer:acme-corp", "topic:communication"],
      createdBy: AGENT_NAME,
      createdAt: now - DAY + 8 * 600000,
      updatedAt: now - DAY + 8 * 600000,
    });

    await ctx.db.insert("teamMemory", {
      content: "Enterprise billing API rate limit should be 500 req/min per SLA. Current config has it at 100 for all tiers.",
      sourceSessionId: s2,
      sourceSessionTitle: "Billing API Rate Limit Fix",
      tags: ["repo:billing-api", "topic:infrastructure"],
      createdBy: AGENT_NAME,
      createdAt: now - DAY + 4 * 900000,
      updatedAt: now - DAY + 4 * 900000,
    });

    await ctx.db.insert("teamMemory", {
      content: "Support war room design: ticket artifact with title/status/resolution, live agent session, queue view, and take-control/resume pattern.",
      sourceSessionId: s3,
      sourceSessionTitle: "Q3 Planning Brainstorm (fork)",
      tags: ["topic:product-design", "module:support-war-room"],
      createdBy: AGENT_NAME,
      createdAt: now - 2 * DAY + 3 * 2400000,
      updatedAt: now - 2 * DAY + 3 * 2400000,
    });

    // ---- Presence (make it look like people are online now) ----
    const presenceTabs = [
      { sessionId: s1, tabId: "demo-tab-sarah", userId: fakeUser1, name: "Sarah Chen", color: "#4DA6FF", focus: "typing" },
      { sessionId: s4, tabId: "demo-tab-me", userId, name, color: "#FF5C5C", focus: undefined },
    ];
    for (const p of presenceTabs) {
      await ctx.db.insert("presence", {
        sessionId: p.sessionId,
        tabId: p.tabId,
        userId: p.userId,
        name: p.name,
        color: p.color,
        cursorX: 0.4 + Math.random() * 0.2,
        cursorY: 0.3 + Math.random() * 0.3,
        focus: p.focus,
        updatedAt: now - 5000,
      });
    }

    return true;
  },
});

/** Check if demo data exists for the current user. */
export const hasDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    // Check if user has any participant entries (seed creates these).
    const all = await ctx.db.query("participants").take(200);
    return all.some((p) => p.userId === userId);
  },
});

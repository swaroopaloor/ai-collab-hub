import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// ---- Multiplayer session engine ----

export const SESSION_STATES = [
  "running",
  "paused",
  "awaiting_input",
  "done",
] as const;
export const sessionStateValidator = v.union(
  ...SESSION_STATES.map((s) => v.literal(s)),
);

export const PARTICIPANT_ROLES = ["driver", "copilot", "observer"] as const;
export const participantRoleValidator = v.union(
  ...PARTICIPANT_ROLES.map((r) => v.literal(r)),
);

export const EVENT_TYPES = [
  "message", // human message
  "agent_message", // agent reply
  "agent_tool_call", // agent tool invocation
  "intervention", // human interrupt / control change
  "system", // joins, state changes
  "summary", // AI catch-up recap
  "fork", // branch marker: a new session was forked from this point
  "proposal", // agent proposes a change gated for review
  "gate_decision", // reviewer approves / rejects / edits a gate
] as const;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),

      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    sessions: defineTable({
      title: v.string(),
      artifactType: v.literal("chat"), // v1: chat room module only
      state: sessionStateValidator,
      joinCode: v.string(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      // live agent activity, ephemeral: e.g. { label: "researching X..." }
      agentActivity: v.optional(v.string()),
      // Autonomous operation: scope set by last driver, agent continues without humans.
      autonomousScope: v.optional(v.string()), // e.g. "full" | "research_only" | "off"
      lastActivityAt: v.optional(v.number()),
      handoffCount: v.number(),
      // Time travel lineage: set when this session was forked from a parent.
      parentId: v.optional(v.id("sessions")),
      forkedAtSeq: v.optional(v.number()), // parent timeline position of the fork
    })
      .index("by_joinCode", ["joinCode"])
      .index("by_createdAt", ["createdAt"])
      .index("by_parent", ["parentId"]),

    participants: defineTable({
      sessionId: v.id("sessions"),
      userId: v.id("users"),
      role: participantRoleValidator,
      joinedAt: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_session_user", ["sessionId", "userId"]),

    events: defineTable({
      sessionId: v.id("sessions"),
      seq: v.number(), // append-only order within session
      type: v.union(...EVENT_TYPES.map((t) => v.literal(t))),
      authorType: v.union(v.literal("human"), v.literal("agent"), v.literal("system")),
      authorId: v.optional(v.id("users")),
      authorName: v.string(),
      content: v.string(),
      // attribution for agent events: "prompted by @name"
      promptedBy: v.optional(v.string()),
      // for tool calls: which tool + result
      toolName: v.optional(v.string()),
      // for fork events: the child session that was branched off here
      childSessionId: v.optional(v.id("sessions")),
    })
      .index("by_session_seq", ["sessionId", "seq"]),

    // Join requests: new users request to join; driver must approve.
    joinRequests: defineTable({
      sessionId: v.id("sessions"),
      userId: v.id("users"),
      requestedRole: participantRoleValidator,
      name: v.string(),
      status: v.union(v.literal("pending"), v.literal("approved"), v.literal("denied")),
      createdAt: v.number(),
      decidedAt: v.optional(v.number()),
      decidedBy: v.optional(v.id("users")),
    })
      .index("by_session", ["sessionId"])
      .index("by_session_user", ["sessionId", "userId"])
      .index("by_session_status", ["sessionId", "status"]),

    // Approval gates: agent proposes a change → pauses → reviewers decide.
    approvalGates: defineTable({
      sessionId: v.id("sessions"),
      eventId: v.id("events"), // the timeline event that triggered this gate
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("edited"),
      ),
      artifactType: v.string(), // "code", "text", "structured", etc.
      title: v.string(),
      beforeContent: v.string(), // original state (text, JSON, diff source)
      afterContent: v.string(), // proposed new state
      editedContent: v.optional(v.string()), // final content if reviewer edited before approve
      comment: v.optional(v.string()), // reviewer comment on reject
      createdBy: v.string(), // agent name that proposed
      createdAt: v.number(),
      decidedAt: v.optional(v.number()),
      decidedBy: v.optional(v.string()),
    })
      .index("by_session", ["sessionId"])
      .index("by_session_status", ["sessionId", "status"]),

    // Knowledge Base: admin-managed documents the agent can search.
    knowledgeBases: defineTable({
      title: v.string(),
      content: v.string(), // full text content of the article
      tags: v.array(v.string()), // e.g. ["billing", "onboarding"]
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_createdAt", ["createdAt"])
      .index("by_tags", ["tags"]),

    // Team Memory: org-wide shared knowledge that persists across sessions.
    teamMemory: defineTable({
      content: v.string(),
      sourceSessionId: v.id("sessions"),
      sourceSessionTitle: v.string(),
      tags: v.array(v.string()), // e.g. ["customer:acme-corp", "repo:billing-service"]
      createdBy: v.string(), // "ox-alpha" or human name
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_createdAt", ["createdAt"])
      .index("by_tags", ["tags"]),

    presence: defineTable({
      sessionId: v.id("sessions"),
      tabId: v.string(), // per browser-tab identity
      userId: v.id("users"),
      name: v.string(),
      color: v.string(),
      cursorX: v.number(), // normalized 0..1
      cursorY: v.number(),
      focus: v.optional(v.string()), // what this participant is looking at
      updatedAt: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_session_tab", ["sessionId", "tabId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;

"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { vly } from "../lib/vly-integrations";

const AGENT_MODEL = "claude-sonnet-4-6";

// ---- Mock tools (stubs returning fake data) ----

function runMockTool(name: string, input: string): string {
  switch (name) {
    case "search_knowledge_base": {
      return JSON.stringify(
        {
          results: [
            {
              title: `KB: Getting started with "${input}"`,
              excerpt: `Our docs recommend starting small. Teams that adopted ${input} saw onboarding time drop by ~40%. Key steps: 1) define scope, 2) assign a driver, 3) review weekly.`,
            },
            {
              title: `KB: Troubleshooting common issues`,
              excerpt:
                "If the issue persists after a restart, collect diagnostics from Settings → Diagnostics and attach them to your ticket.",
            },
          ],
        },
        null,
        2,
      );
    }
    case "lookup_customer_record": {
      return JSON.stringify(
        {
          customer: {
            id: "CUST-4821",
            name: "Acme Corp",
            plan: "Team (annual)",
            since: "2024-11-03",
            openTickets: 1,
            notes: "Priority support. Escalated twice in the past year.",
          },
        },
        null,
        2,
      );
    }
    case "get_current_time": {
      return new Date().toISOString();
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

const TOOL_SPECS = [
  {
    name: "search_knowledge_base",
    description:
      "Search the internal knowledge base for articles relevant to a query.",
    example: '{"tool":"search_knowledge_base","input":"billing FAQ"}',
  },
  {
    name: "lookup_customer_record",
    description:
      "Look up a customer account record by name or email.",
    example: '{"tool":"lookup_customer_record","input":"acme corp"}',
  },
];

const SYSTEM_PROMPT = `You are Claude, an AI teammate collaborating inside a shared multiplayer session. Multiple humans are watching you work live in one chat thread.

Rules:
- You may call tools before answering. Available tools:
${TOOL_SPECS.map((t) => `- ${t.name}: ${t.description} Example args: ${t.example}`).join("\n")}

- To call a tool, reply with ONLY a JSON object:
  {"thought": "<one short sentence shown to everyone>", "tool": "<tool name>", "input": "<tool input>"}
- When you have enough context, reply with ONLY a JSON object:
  {"reply": "<your message to the thread. Be concise and helpful. Address humans by name when responding to them.>"}
- If the conversation contains an [INTERRUPTION] marker, acknowledge the redirect and fold it into your current work — do not lose the original task.
- Never output anything except a single JSON object.`;

interface AgentEvent {
  type: string;
  authorType: string;
  authorName: string;
  content: string;
  promptedBy?: string;
  seq: number;
}

function renderThread(events: AgentEvent[]): string {
  return events
    .map((e) => {
      switch (e.type) {
        case "message":
          return `[${e.seq}] ${e.authorName} (human): ${e.content}`;
        case "agent_message":
          return `[${e.seq}] You (Claude): ${e.content}`;
        case "agent_tool_call":
          return `[${e.seq}] You used a tool: ${e.content}`;
        case "intervention":
          return `[${e.seq}] INTERVENTION by ${e.authorName}: ${e.content}`;
        case "summary":
          return `[${e.seq}] Recap posted earlier: ${e.content}`;
        default:
          return `[${e.seq}] (${e.type}) ${e.authorName}: ${e.content}`;
      }
    })
    .join("\n");
}

async function askModel(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<{ ok: boolean; text: string }> {
  let result = await vly.ai.completion({
    model: AGENT_MODEL,
    messages,
    temperature: 0.4,
    maxTokens: 700,
  });
  if (!result.success) {
    // Fall back to the gateway default model if claude is unavailable.
    result = await vly.ai.completion({
      messages,
      temperature: 0.4,
      maxTokens: 700,
    });
  }
  if (!result.success || !result.data?.choices?.[0]?.message?.content) {
    return { ok: false, text: result.error ?? "Model returned no content." };
  }
  return { ok: true, text: result.data.choices[0].message.content };
}

function parseModelJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const runTurn = internalAction({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const conversation: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: SYSTEM_PROMPT }];

    try {
      for (let iteration = 0; iteration < 5; iteration++) {
        const session = await ctx.runQuery(api.sessions.getSession, { sessionId });
        if (!session || session.state !== "running") break;

        const events = (await ctx.runQuery(api.events.listEvents, {
          sessionId,
        })) as AgentEvent[];

        // Human messages since our last agent output = pending work.
        const lastAgentIdx = events.reduce(
          (acc, e, i) => (e.authorType === "agent" ? i : acc),
          -1,
        );
        const pendingHuman = events.filter(
          (e, i) =>
            i > lastAgentIdx &&
            e.authorType === "human" &&
            (e.type === "message" || e.type === "intervention"),
        );
        if (pendingHuman.length === 0 && conversation.length > 1) {
          // Nothing left to respond to.
          break;
        }

        // Attribution: who prompted this turn (last human to @mention).
        const mentionMsg = [...events]
          .reverse()
          .find((e) => e.type === "message" && /@(claude|agent)\b/i.test(e.content));
        const attribution = mentionMsg?.authorName ?? pendingHuman[0]?.authorName ?? "the team";

        const interruptionNote =
          iteration > 0
            ? `\n\n[INTERRUPTION] While you were working, these new human messages arrived. Incorporate them without losing your original task:\n${pendingHuman.map((m) => `- ${m.authorName}: ${m.content}`).join("\n")}`
            : "";

        conversation.push({
          role: "user",
          content: `Session timeline so far:\n${renderThread(events)}\n\nThe humans are waiting for you, Claude.${interruptionNote}\nRespond with your single JSON object now.`,
        });

        await ctx.runMutation(internal.sessions.internalSetActivity, {
          sessionId,
          label: "Claude is thinking...",
          state: "running",
        });

        const { ok, text } = await askModel(conversation);
        if (!ok) {
          await ctx.runMutation(internal.sessions.internalAppendEvent, {
            sessionId,
            type: "system",
            authorType: "system",
            authorName: "System",
            content: `Agent error: ${text}`,
          });
          break;
        }

        const parsed = parseModelJson(text);
        if (!parsed) {
          // Model didn't follow format; post raw text as its message.
          await ctx.runMutation(internal.sessions.internalAppendEvent, {
            sessionId,
            type: "agent_message",
            authorType: "agent",
            authorName: "Claude",
            content: text.slice(0, 2000),
            promptedBy: attribution,
          });
          break;
        }

        if (typeof parsed.tool === "string") {
          const toolName = parsed.tool;
          const input = String(parsed.input ?? "");
          await ctx.runMutation(internal.sessions.internalAppendEvent, {
            sessionId,
            type: "agent_tool_call",
            authorType: "agent",
            authorName: "Claude",
            content: `${String(parsed.thought ?? `Using ${toolName}`)} → ${toolName}("${input}")`,
            toolName,
            promptedBy: attribution,
          });
          await ctx.runMutation(internal.sessions.internalSetActivity, {
            sessionId,
            label: `Claude is running ${toolName}...`,
          });
          const result = runMockTool(toolName, input);
          conversation.push({
            role: "assistant",
            content: JSON.stringify(parsed),
          });
          conversation.push({
            role: "user",
            content: `Tool result for ${toolName}:\n${result}`,
          });
          continue; // loop: agent can call more tools or answer
        }

        // Final reply.
        const reply =
          typeof parsed.reply === "string"
            ? parsed.reply
            : typeof parsed.content === "string"
              ? parsed.content
              : text;
        conversation.push({ role: "assistant", content: JSON.stringify(parsed) });

        await ctx.runMutation(internal.sessions.internalAppendEvent, {
          sessionId,
          type: "agent_message",
          authorType: "agent",
          authorName: "Claude",
          content: reply,
          promptedBy: attribution,
        });

        // Did a human interrupt us while we were generating? If so, keep going.
        const freshEvents = (await ctx.runQuery(api.events.listEvents, {
          sessionId,
        })) as AgentEvent[];
        const newPending = freshEvents.filter(
          (e) =>
            e.seq > (events[events.length - 1]?.seq ?? 0) &&
            e.authorType === "human" &&
            e.type === "message",
        );

        if (newPending.length > 0) {
          await ctx.runMutation(internal.sessions.internalSetActivity, {
            sessionId,
            label: "Claude noticed an interruption...",
          });
          continue;
        }

        await ctx.runMutation(internal.sessions.internalSetActivity, {
          sessionId,
          state: "awaiting_input",
        });
        return;
      }

      // Loop exhausted or stopped early.
      await ctx.runMutation(internal.sessions.internalSetActivity, {
        sessionId,
        state: "awaiting_input",
      });
    } catch (err) {
      await ctx.runMutation(internal.sessions.internalSetActivity, {
        sessionId,
        state: "awaiting_input",
      });
      await ctx.runMutation(internal.sessions.internalAppendEvent, {
        sessionId,
        type: "system",
        authorType: "system",
        authorName: "System",
        content: `Agent crashed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },
});

/** AI-written catch-up summary for participants joining mid-session. */
export const generateJoinSummary = internalAction({
  args: { sessionId: v.id("sessions"), forUserName: v.string() },
  handler: async (ctx, { sessionId, forUserName }) => {
    const events = (await ctx.runQuery(api.events.listEvents, {
      sessionId,
    })) as AgentEvent[];
    if (events.filter((e) => e.type !== "system").length < 3) return;

    const session = await ctx.runQuery(api.sessions.getSession, { sessionId });
    if (!session) return;

    const { ok, text } = await askModel([
      {
        role: "system",
        content:
          "Write a very short recap (max 3 sentences) of what has happened in this collaborative session so far, for a teammate who just joined. Plain text only, no JSON.",
      },
      {
        role: "user",
        content: `Session "${session.title}" timeline:\n${renderThread(events)}\n\nWrite the recap for ${forUserName}.`,
      },
    ]);

    if (!ok) return;

    // Don't stack duplicate summaries back-to-back.
    const last = events[events.length - 1];
    if (last?.type === "summary") return;

    await ctx.runMutation(internal.sessions.internalSetActivity, {
      sessionId,
    });
    await ctx.runMutation(internal.sessions.internalAppendEvent, {
      sessionId,
      type: "summary",
      authorType: "system",
      authorName: "Claude",
      content: text,
    });
  },
});

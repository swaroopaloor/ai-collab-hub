"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

// ---- Model configuration -------------------------------------------------
// ox-alpha via any OpenAI-compatible endpoint. Set these env vars once you
// have the token (Keys / API keys tab):
//   OX_ALPHA_API_KEY   — bearer token for the endpoint
//   OX_ALPHA_BASE_URL  — e.g. https://api.example.com/v1  (must expose /chat/completions)
//   OX_ALPHA_MODEL     — optional model id override (defaults to "ox-alpha")
//
// Until the key is set (or if the endpoint fails), the agent runs in offline
// simulation mode: deterministic responses that still exercise the full tool
// loop, interruption handling, attribution and summaries so Phases 1-2 work
// end-to-end right now.
const AGENT_MODEL = process.env.OX_ALPHA_MODEL ?? "ox-alpha";
const AGENT_NAME = "ox-alpha";

function isModelConfigured(): boolean {
  return Boolean(process.env.OX_ALPHA_API_KEY && process.env.OX_ALPHA_BASE_URL);
}

// ---- Mock tools (stubs returning fake data) -------------------------------

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
              title: "KB: Troubleshooting common issues",
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

const SYSTEM_PROMPT = `You are ${AGENT_NAME}, an AI teammate collaborating inside a shared multiplayer session. Multiple humans are watching you work live in one chat thread.

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

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function renderThread(events: AgentEvent[]): string {
  return events
    .map((e) => {
      switch (e.type) {
        case "message":
          return `[${e.seq}] ${e.authorName} (human): ${e.content}`;
        case "agent_message":
          return `[${e.seq}] You (${AGENT_NAME}): ${e.content}`;
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

// ---- Live model call (ox-alpha, OpenAI-compatible) ------------------------

async function callOxAlpha(
  messages: ChatMessage[],
): Promise<{ ok: boolean; text: string }> {
  const apiKey = process.env.OX_ALPHA_API_KEY;
  const baseUrl = (process.env.OX_ALPHA_BASE_URL ?? "").replace(/\/+$/, "");
  if (!apiKey || !baseUrl) {
    return { ok: false, text: "ox-alpha not configured." };
  }
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AGENT_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });
    if (!res.ok) {
      console.warn(`[ox-alpha] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { ok: false, text: `ox-alpha HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, text: "ox-alpha returned no content." };
    }
    return {
      ok: true,
      text: typeof content === "string" ? content : JSON.stringify(content),
    };
  } catch (err) {
    console.warn("[ox-alpha] request failed:", err);
    return {
      ok: false,
      text: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---- Offline simulation fallback ------------------------------------------

function extractLastHuman(threadBlock: string): { name: string; text: string } | null {
  const lines = threadBlock.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\[\d+\] (.+?) \(human\): (.+)$/);
    if (m) return { name: m[1], text: m[2] };
  }
  return null;
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Deterministic stand-in for the model while OX_ALPHA_* env vars are unset
 *  (or when the live endpoint fails). Emits the same JSON protocol. */
function simulateModel(conversation: ChatMessage[]): string {
  const lastUser = [...conversation].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return JSON.stringify({ reply: "I'm online and ready — @mention me anytime." });
  }

  // After a tool result, summarize what we found.
  if (lastUser.content.startsWith("Tool result")) {
    const toolName = lastUser.content.match(/^Tool result for (\w+)/)?.[1];
    if (toolName === "lookup_customer_record") {
      return JSON.stringify({
        reply:
          "Found the record: Acme Corp on the Team (annual) plan since Nov 2024 — priority support, one open ticket, two past escalations. Given their history I'd treat this as high priority. Want me to draft a resolution next?",
      });
    }
    return JSON.stringify({
      reply:
        "The knowledge base has two relevant articles. Short version: start small, define scope, assign a driver, review weekly (~40% faster onboarding). If issues persist, grab diagnostics from Settings → Diagnostics and attach them. Anything specific you'd like me to dig into?",
    });
  }

  const human = extractLastHuman(lastUser.content);
  const interrupted = lastUser.content.includes("[INTERRUPTION]");
  const text = human?.text ?? "";

  if (/search|kb|knowledge|docs|article|look\s?up|customer|record|research/i.test(text)) {
    const tool = /customer|record/i.test(text)
      ? "lookup_customer_record"
      : "search_knowledge_base";
    return JSON.stringify({
      thought: `Let me look up "${truncate(text.replace(/@\S+/g, ""), 60)}"...`,
      tool,
      input: text.replace(/@\S+/g, "").trim().slice(0, 80),
    });
  }

  const greeting = human ? `Got it, ${human.name}` : "Got it";
  const ack = interrupted
    ? " I saw the interruption mid-turn and folded it in without dropping the original task. "
    : " ";
  return JSON.stringify({
    reply: `${greeting}.${ack}Here's my take on "${truncate(text)}": break it into a small first step, assign an owner, and iterate. (Running in offline simulation mode until the ox-alpha token is configured.) @mention me again anytime.`,
  });
}

/** Heuristic join-summary used when no model is available. */
function simulateSummary(sessionTitle: string, events: AgentEvent[]): string {
  const humans = [
    ...new Set(
      events.filter((e) => e.authorType === "human").map((e) => e.authorName),
    ),
  ];
  const lastMessages = events
    .filter((e) => e.type === "message" || e.type === "agent_message")
    .slice(-2)
    .map((e) => `${e.authorName}: "${truncate(e.content, 80)}"`);
  return `Catch-up on "${sessionTitle}": ${humans.length > 0 ? humans.join(", ") : "the team"} discussed ${events.filter((e) => e.type === "message").length} message(s)${
    events.some((e) => e.type === "agent_tool_call") ? ", and ox-alpha ran some tool lookups" : ""
  }. Latest: ${lastMessages.join(" · ") || "nothing yet"}.`;
}

async function askModel(
  conversation: ChatMessage[],
): Promise<{ ok: boolean; text: string }> {
  if (isModelConfigured()) {
    const live = await callOxAlpha(conversation);
    if (live.ok) return live;
    console.warn("[ox-alpha] falling back to offline simulation:", live.text);
  }
  return { ok: true, text: simulateModel(conversation) };
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
    const conversation: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

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
          .find((e) => e.type === "message" && /@(claude|agent|ox[- ]?alpha)\b/i.test(e.content));
        const attribution = mentionMsg?.authorName ?? pendingHuman[0]?.authorName ?? "the team";

        const interruptionNote =
          iteration > 0
            ? `\n\n[INTERRUPTION] While you were working, these new human messages arrived. Incorporate them without losing your original task:\n${pendingHuman.map((m) => `- ${m.authorName}: ${m.content}`).join("\n")}`
            : "";

        conversation.push({
          role: "user",
          content: `Session timeline so far:\n${renderThread(events)}\n\nThe humans are waiting for you, ${AGENT_NAME}.${interruptionNote}\nRespond with your single JSON object now.`,
        });

        await ctx.runMutation(internal.sessions.internalSetActivity, {
          sessionId,
          label: `${AGENT_NAME} is thinking...`,
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
            authorName: AGENT_NAME,
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
            authorName: AGENT_NAME,
            content: `${String(parsed.thought ?? `Using ${toolName}`)} → ${toolName}("${input}")`,
            toolName,
            promptedBy: attribution,
          });
          await ctx.runMutation(internal.sessions.internalSetActivity, {
            sessionId,
            label: `${AGENT_NAME} is running ${toolName}...`,
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
          authorName: AGENT_NAME,
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
            label: `${AGENT_NAME} noticed an interruption...`,
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

    // Don't stack duplicate summaries back-to-back.
    const last = events[events.length - 1];
    if (last?.type === "summary") return;

    let summary: string | null = null;
    if (isModelConfigured()) {
      const live = await callOxAlpha([
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
      if (live.ok) summary = live.text.trim();
    }
    if (!summary) summary = simulateSummary(session.title, events);

    await ctx.runMutation(internal.sessions.internalSetActivity, {
      sessionId,
    });
    await ctx.runMutation(internal.sessions.internalAppendEvent, {
      sessionId,
      type: "summary",
      authorType: "system",
      authorName: AGENT_NAME,
      content: summary,
    });
  },
});

"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";

// ---- Model configuration -------------------------------------------------
// Groq free tier (OpenAI-compatible). Set these env vars in the Keys / API
// keys tab:
//   GROQ_API_KEY  — bearer token from https://console.groq.com/keys
//
// Fallback env vars (any OpenAI-compatible endpoint):
//   OX_ALPHA_API_KEY   — bearer token for the endpoint
//   OX_ALPHA_BASE_URL  — e.g. https://api.example.com/v1
//   OX_ALPHA_MODEL     — optional model id override
//
// Until a key is set (or if the endpoint fails), the agent runs in offline
// simulation mode: deterministic responses that still exercise the full tool
// loop, interruption handling, attribution and summaries.

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "openai/gpt-oss-120b";

const AGENT_NAME = "AI";

type ModelBackend = { baseUrl: string; apiKey: string; model: string };

function resolveModel(): ModelBackend | null {
  // Prefer Groq (free tier, ultra-fast)
  if (process.env.GROQ_API_KEY) {
    return {
      baseUrl: GROQ_BASE_URL,
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.OX_ALPHA_MODEL ?? GROQ_MODEL,
    };
  }
  // Fallback: any OpenAI-compatible endpoint
  if (process.env.OX_ALPHA_API_KEY && process.env.OX_ALPHA_BASE_URL) {
    return {
      baseUrl: process.env.OX_ALPHA_BASE_URL.replace(/\/+$/, ""),
      apiKey: process.env.OX_ALPHA_API_KEY,
      model: process.env.OX_ALPHA_MODEL ?? "gpt-4o-mini",
    };
  }
  return null;
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
    case "search_team_memory": {
      const lower = input.toLowerCase();
      if (lower.includes("acme") || lower.includes("billing")) {
        return JSON.stringify({
          memories: [
            {
              content: "Acme Corp prefers email over phone for billing disputes. They are on the Team annual plan since Nov 2024.",
              tags: ["customer:acme-corp", "topic:billing"],
              sourceSessionTitle: "Launch War Room",
              sourceSessionId: "demo-session",
            },
          ],
        }, null, 2);
      }
      return JSON.stringify({ memories: [] }, null, 2);
    }
    case "save_memory": {
      const pipeIdx = input.indexOf("|");
      const tagsPart = pipeIdx >= 0 ? input.slice(0, pipeIdx) : "";
      const content = pipeIdx >= 0 ? input.slice(pipeIdx + 1).trim() : input;
      const tags = tagsPart.replace("tags=", "").split(",").map((t) => t.trim()).filter(Boolean);
      return JSON.stringify({ saved: true, content, tags }, null, 2);
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
  {
    name: "search_team_memory",
    description:
      "Search Team Memory for durable facts learned across all sessions (customer preferences, codebase conventions, recurring patterns). Use this at the start of any task to check if prior sessions already solved it.",
    example: '{"tool":"search_team_memory","input":"acme corp billing"}',
  },
  {
    name: "save_memory",
    description:
      "Save a durable fact to Team Memory for future sessions. Use ONLY for information that is reusable across sessions: customer preferences, bug patterns, codebase conventions, key facts about a deal or project. Do NOT save ephemeral chat messages.",
    example: '{"tool":"save_memory","input":"tags=customer:acme-corp,topic:billing|Acme Corp prefers email over phone for billing disputes. They are on the Team annual plan since Nov 2024."}',
  },
];

const SYSTEM_PROMPT = `You are an AI teammate collaborating inside a shared multiplayer session. Multiple humans are watching you work live in one chat thread.

IMPORTANT: Write ALL your replies as plain conversational text — like a helpful human colleague would write in a team chat. Be warm, direct, and specific. Use natural language, not formal or robotic phrasing. Address people by name when responding to them.

You have access to tools:
${TOOL_SPECS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

HOW TO USE TOOLS:
To call a tool, output ONLY a JSON object (nothing else):
{"thought": "<short sentence shown to everyone>", "tool": "<tool name>", "input": "<tool input>"}
For save_memory, input format: tags=tag1,tag2|<memory content>

HOW TO REPLY TO HUMANS:
Just write your message as plain text. Do NOT wrap it in JSON. Do NOT use code fences. Just write naturally, like you're chatting with a coworker.

Example of a GOOD reply:
Hey Sarah! I looked into the billing issue for Acme Corp. They're on the Team annual plan since November 2024 and have had two escalations in the past year. I'd recommend treating this as high priority given their history.

Example of a BAD reply (never do this):
{"reply": "Hey Sarah! I looked into the billing issue..."}

PROPOSALS:
When you want to propose a change that needs human review, output ONLY:
{"proposal": {"title": "<short title>", "artifactType": "<code|text|structured>", "before": "<current state>", "after": "<proposed new state>"}}

RULES:
- If the conversation contains an [INTERRUPTION] marker, acknowledge it and fold it into your current work.
- If the conversation contains [TEAM_MEMORY] entries, cite them when relevant.
- Never output JSON when responding to humans. JSON is ONLY for tool calls and proposals.
- Be concise and helpful. No filler, no fluff.`;

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
          return `[${e.seq}] You (AI): ${e.content}`;
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

// ---- Live model call (Groq or any OpenAI-compatible endpoint) ---------------

async function callLlm(
  messages: ChatMessage[],
  opts: { jsonMode?: boolean } = {},
): Promise<{ ok: boolean; text: string }> {
  const backend = resolveModel();
  if (!backend) {
    return { ok: false, text: "No AI model configured." };
  }
  const label = backend.baseUrl.includes("groq") ? "groq" : "llm";

  const attempt = (withJsonMode: boolean) =>
    fetch(`${backend.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${backend.apiKey}`,
      },
      body: JSON.stringify({
        model: backend.model,
        messages,
        temperature: 0.4,
        max_tokens: 700,
        // Force strict JSON so the model never drifts into prose or leaks
        // partial JSON into the thread.
        ...(withJsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

  try {
    let res = await attempt(!!opts.jsonMode);
    // Some endpoints/models reject response_format — retry once without it.
    if (!res.ok && res.status === 400 && opts.jsonMode) {
      res = await attempt(false);
    }
    if (!res.ok) {
      console.warn(`[${label}] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return { ok: false, text: `${label} HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, text: `${label} returned no content.` };
    }
    return {
      ok: true,
      text: typeof content === "string" ? content : JSON.stringify(content),
    };
  } catch (err) {
    console.warn(`[${label}] request failed:`, err);
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

/** Deterministic stand-in for the model while no API key is set
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
        thought: "Saving what I learned about Acme Corp to Team Memory...",
        tool: "save_memory",
        input: "tags=customer:acme-corp,topic:support|Acme Corp is on Team (annual) since Nov 2024. Priority support customer with 2 past escalations. Currently has 1 open ticket. Treat all issues as high priority.",
      });
    }
    if (toolName === "save_memory") {
      return JSON.stringify({
        reply:
          "Found the record: Acme Corp on the Team (annual) plan since Nov 2024 — priority support, one open ticket, two past escalations. I've saved this to Team Memory so future sessions will know. Given their history I'd treat this as high priority. Want me to draft a resolution next?",
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
    reply: `${greeting}.${ack}Here's my take on "${truncate(text)}": break it into a small first step, assign an owner, and iterate. (Running in offline simulation mode until an AI model API key is configured.) @mention me again anytime.`,
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
    events.some((e) => e.type === "agent_tool_call") ? ", and the AI agent ran some tool lookups" : ""
  }. Latest: ${lastMessages.join(" · ") || "nothing yet"}.`;
}

async function askModel(
  conversation: ChatMessage[],
): Promise<{ ok: boolean; text: string }> {
  const backend = resolveModel();
  if (backend) {
    const live = await callLlm(conversation, { jsonMode: true });
    if (live.ok) return live;
    console.warn("[agent] falling back to offline simulation:", live.text);
  }
  return { ok: true, text: simulateModel(conversation) };
}

/**
 * Recover the human-readable reply from a model response that did not parse as
 * our JSON protocol. Strips code fences, pulls text out of wrapper objects,
 * and falls back to the raw text only if nothing structured survives.
 */
/** Aggressively extract human-readable text from model output.
 *  The model should write plain text, but if it accidentally returns JSON,
 *  we dig out the reply and discard the protocol wrapper. */
function salvageReply(text: string): string | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!cleaned) return null;

  // Try to parse as JSON — if it fails, it's already plain prose.
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (typeof parsed === "string") return parsed.trim();
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      // Extract from known reply keys.
      for (const key of ["reply", "message", "content", "text", "response", "answer"]) {
        const val = obj[key];
        if (typeof val === "string" && val.trim()) return val.trim();
      }
      // Nested object (e.g. {"reply": {"text": ...}}).
      for (const key of ["reply", "message"]) {
        const val = obj[key];
        if (val && typeof val === "object") {
          const nested = val as Record<string, unknown>;
          for (const k of ["text", "content", "message"]) {
            if (typeof nested[k] === "string" && nested[k]) return (nested[k] as string).trim();
          }
        }
      }
      // Give up on JSON — don't return the raw object.
      return null;
    }
  } catch {
    // Not JSON — clean up any stray backticks or protocol remnants.
  }

  // Remove any JSON-looking wrapper if present: {"reply": "..."}
  const jsonWrapper = cleaned.match(/\{"(?:reply|message|content|text|response)":\s*"([\s\S]*?)"\}/);
  if (jsonWrapper) return jsonWrapper[1];

  // Strip leading/trailing protocol syntax.
  const stripped = cleaned
    .replace(/^(?:Thought|Thought:|Tool|Reply|Response):\s*/i, "")
    .replace(/^\{"(?:thought|tool|input|reply|proposal)"[\s\S]*$/m, "")
    .trim();

  return stripped || null;
}

/** Detect if the model output is a tool-call JSON object.
 *  Returns the parsed object if it looks like a valid tool call or proposal,
 *  otherwise null (meaning the output is plain prose — a reply to the thread). */
function parseModelJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!cleaned.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    // Only treat as protocol JSON if it has tool/proposal structure.
    if (typeof parsed === "object" && parsed !== null && ("tool" in parsed || "proposal" in parsed)) {
      return parsed;
    }
    // A plain {"reply": ...} wrapper — extract the reply text instead.
    return null;
  } catch {
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
      // ---- Inject relevant Team Memory at session start ----
      try {
        const memories = (await ctx.runQuery(api.memory.relevantMemory, {
          tags: [], // fetch broadly; model will decide what's relevant
        })) as Array<{ content: string; tags: string[]; sourceSessionTitle: string; sourceSessionId: string }>;
        if (memories.length > 0) {
          const memoryBlock = memories
            .slice(0, 10)
            .map(
              (m) =>
                `- [${m.sourceSessionTitle}] ${m.content} (tags: ${m.tags.join(", ")})`,
            )
            .join("\n");
          conversation.push({
            role: "user",
            content: `[TEAM_MEMORY] Facts learned from prior sessions. Cite these when relevant and mention the source session:\n${memoryBlock}`,
          });
        }
      } catch {
        // Memory table may not exist yet; continue without it.
      }

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
          // Check autonomous scope: if set and no humans present, continue working.
          const autonomousScope = session.autonomousScope;
          if (autonomousScope && autonomousScope !== "off") {
            conversation.push({
              role: "user",
              content: `[AUTONOMOUS MODE — scope: ${autonomousScope}] No humans are currently present. Continue working on the session's goals autonomously. Make progress, save findings to Team Memory, and propose changes via gates. Do NOT send chat messages — only use tools and proposals.`,
            });
          } else {
            break;
          }
        }

        // Attribution: who prompted this turn (last human to @mention).
        const mentionMsg = [...events]
          .reverse()
          .find((e) => e.type === "message" && /@(claude|agent|ai)\b/i.test(e.content));
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
          // Model wrote plain conversational text — this is the expected
          // path for normal replies. Post it directly.
          const replyText = salvageReply(text) ?? text.trim();
          if (!replyText) {
            await ctx.runMutation(internal.sessions.internalAppendEvent, {
              sessionId,
              type: "system",
              authorType: "system",
              authorName: "System",
              content: `Agent returned an empty response.`,
            });
            break;
          }
          await ctx.runMutation(internal.sessions.internalAppendEvent, {
            sessionId,
            type: "agent_message",
            authorType: "agent",
            authorName: AGENT_NAME,
            content: replyText.slice(0, 2000),
            promptedBy: attribution,
          });
          // Check for interruptions before finishing.
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

        if (typeof parsed.tool === "string") {
          const toolName = parsed.tool;
          // Inputs may arrive as non-strings (numbers, nested objects) —
          // stringify them readably instead of "[object Object]".
          const rawInput = parsed.input;
          const input =
            typeof rawInput === "string"
              ? rawInput
              : rawInput === undefined || rawInput === null
                ? ""
                : JSON.stringify(rawInput);
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
          let result: string;
          if (toolName === "search_knowledge_base") {
            // Query real knowledge base data
            try {
              const kbResults = (await ctx.runQuery(
                api.knowledgeBases.internalSearchKnowledgeBases,
                { query: input },
              )) as Array<{ title: string; excerpt: string; tags: string[] }>;
              result = JSON.stringify({ results: kbResults }, null, 2);
            } catch {
              // KB table may not exist yet; fall back to mock
              result = runMockTool(toolName, input);
            }
          } else {
            result = runMockTool(toolName, input);
          }

          // If save_memory, persist to Team Memory.
          if (toolName === "save_memory") {
            try {
              const pipeIdx = input.indexOf("|");
              const tagsPart = pipeIdx >= 0 ? input.slice(0, pipeIdx) : "";
              const memContent = pipeIdx >= 0 ? input.slice(pipeIdx + 1).trim() : input;
              const tags = tagsPart.replace("tags=", "").split(",").map((t) => t.trim()).filter(Boolean);
              const session = await ctx.runQuery(api.sessions.getSession, { sessionId });
              await ctx.runMutation(internal.memory.agentSaveMemory, {
                content: memContent,
                sourceSessionId: sessionId,
                sourceSessionTitle: session?.title ?? "unknown",
                tags,
                createdBy: AGENT_NAME,
              });
            } catch (err) {
              console.warn("[memory] failed to save:", err);
            }
          }

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

        // Proposal: agent wants a change reviewed before applying.
        const proposal = parsed.proposal as Record<string, string> | undefined;
        if (proposal && typeof proposal.title === "string") {
          const before = String(proposal.before ?? "");
          const after = String(proposal.after ?? "");
          const artifactType = String(proposal.artifactType ?? "text");
          const thoughtMsg = String(parsed.thought ?? `Proposing: ${proposal.title}`);

          await ctx.runMutation(internal.sessions.internalAppendEvent, {
            sessionId,
            type: "agent_message",
            authorType: "agent",
            authorName: AGENT_NAME,
            content: thoughtMsg,
            promptedBy: attribution,
          });

          await ctx.runMutation(
            internal.sessions.internalAppendEvent,
            {
              sessionId,
              type: "proposal",
              authorType: "agent",
              authorName: AGENT_NAME,
              content: `proposed: "${proposal.title}" — awaiting review`,
              promptedBy: attribution,
            },
          );

          const proposalEvents = (await ctx.runQuery(api.events.listEvents, {
            sessionId,
          })) as Array<{ _id: string; type: string; authorName: string }>;
          const proposalEvent = [...proposalEvents].reverse().find(
            (e) => e.type === "proposal" && e.authorName === AGENT_NAME,
          );

          await ctx.runMutation(internal.gates.createGate, {
            sessionId,
            eventId: (proposalEvent?._id ?? proposalEvents[proposalEvents.length - 1]?._id) as Id<"events">,
            artifactType,
            title: proposal.title,
            beforeContent: before,
            afterContent: after,
            createdBy: AGENT_NAME,
          });

          return;
        }

        // If parsed has no tool/proposal, treat as a reply attempt.
        if (typeof parsed.reply === "string" && parsed.reply.trim()) {
          // Model wrapped reply in JSON despite instructions — extract it.
          const replyText = salvageReply(JSON.stringify({ reply: parsed.reply })) ?? parsed.reply;
          await ctx.runMutation(internal.sessions.internalAppendEvent, {
            sessionId,
            type: "agent_message",
            authorType: "agent",
            authorName: AGENT_NAME,
            content: replyText.slice(0, 2000),
            promptedBy: attribution,
          });
        } else {
          // Unknown JSON structure — salvage what we can.
          const replyText = salvageReply(text) ?? "Sorry — I hit a snag formatting my response. @mention me again and I'll try again.";
          await ctx.runMutation(internal.sessions.internalAppendEvent, {
            sessionId,
            type: "agent_message",
            authorType: "agent",
            authorName: AGENT_NAME,
            content: replyText.slice(0, 2000),
            promptedBy: attribution,
          });
        }
        conversation.push({ role: "assistant", content: JSON.stringify(parsed) });

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

    const last = events[events.length - 1];
    if (last?.type === "summary") return;

    let summary: string | null = null;
    if (resolveModel()) {
      const live = await callLlm([
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

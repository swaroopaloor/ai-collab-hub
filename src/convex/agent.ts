"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { type Id } from "./_generated/dataModel";

// ---- Model configuration -------------------------------------------------
// All LLM calls route through Experiential gateway (gpt-5.6-luna). Set this
// env var in the Keys / API keys tab:
//   EXPLABS_API_KEY  — bearer token from Settings -> API Keys
//
// Fallback (Groq free tier):
//   GROQ_API_KEY  — bearer token from https://console.groq.com/keys
//
// Fallback (any OpenAI-compatible endpoint):
//   OX_ALPHA_API_KEY   — bearer token
//   OX_ALPHA_BASE_URL  — e.g. https://api.example.com/v1
//   OX_ALPHA_MODEL     — optional model id override
//
// Until a key is set (or if the endpoint fails), the agent runs in offline
// simulation mode: deterministic responses that still exercise the full tool
// loop, interruption handling, attribution and summaries.

const EXPLABS_BASE_URL = "https://api.experientiallabs.ai/v1";
const EXPLABS_MODEL = "gpt-5.6-luna";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "openai/gpt-oss-120b";

const AGENT_NAME = "AI";

type ModelBackend = { baseUrl: string; apiKey: string; model: string };

function resolveModel(): ModelBackend | null {
  // 1. Experiential gateway (gpt-5.6-luna)
  if (process.env.EXPLABS_API_KEY) {
    return {
      baseUrl: EXPLABS_BASE_URL,
      apiKey: process.env.EXPLABS_API_KEY,
      model: process.env.OX_ALPHA_MODEL ?? EXPLABS_MODEL,
    };
  }
  // 2. Groq free tier (ultra-fast)
  if (process.env.GROQ_API_KEY) {
    return {
      baseUrl: GROQ_BASE_URL,
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.OX_ALPHA_MODEL ?? GROQ_MODEL,
    };
  }
  // 3. Fallback: any OpenAI-compatible endpoint
  if (process.env.OX_ALPHA_API_KEY && process.env.OX_ALPHA_BASE_URL) {
    return {
      baseUrl: process.env.OX_ALPHA_BASE_URL.replace(/\/+$/, ""),
      apiKey: process.env.OX_ALPHA_API_KEY,
      model: process.env.OX_ALPHA_MODEL ?? "gpt-4o-mini",
    };
  }
  return null;
}

// ---- Web search and URL fetch (real implementations) ----------------------

async function webSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const encoded = encodeURIComponent(query);
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AI-Agent/1.0)",
    },
  });
  if (!res.ok) throw new Error(`DuckDuckGo returned ${res.status}`);
  const html = await res.text();

  // Extract search results from DuckDuckGo HTML.
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    const snippet = match[3].replace(/<[^>]+>/g, "").trim();
    if (url && title) {
      results.push({ title, url, snippet });
    }
  }
  return results;
}

async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AI-Agent/1.0)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Extract readable text from HTML.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Return first 8000 chars to avoid token overflow.
  return text.length > 8000 ? text.slice(0, 8000) + "\n[content truncated]" : text;
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
    case "generate_code": {
      return JSON.stringify({
        language: "auto-detected",
        code: `// Generated code for: ${input}\n// This is a template — the AI model will provide the actual implementation.`,
        explanation: "Code generated based on your request.",
      }, null, 2);
    }
    case "analyze_data": {
      return JSON.stringify({
        analysis: `Analyzed the data provided. Key findings for: ${input}`,
        insights: ["Data patterns identified", "Summary statistics computed"],
      }, null, 2);
    }
    case "summarize": {
      const wordCount = input.split(/\s+/).length;
      return JSON.stringify({
        summary: `Summary of the provided text (${wordCount} words): Key points extracted.`,
        wordCount,
      }, null, 2);
    }
    case "translate": {
      return JSON.stringify({
        translation: `Translated version of: ${input}`,
        sourceLanguage: "auto-detected",
        targetLanguage: "detected from input",
      }, null, 2);
    }
    case "read_file": {
      return JSON.stringify({
        content: `[File content for ${input} would appear here. The agent needs to query the files table to read actual uploaded file content.]`,
        fileName: input,
      }, null, 2);
    }
    case "generate_file": {
      const parts = input.split("|");
      const fileName = parts[0] || "output.txt";
      const fileContent = parts.slice(1).join("|") || "Generated content";
      return JSON.stringify({
        success: true,
        fileName,
        size: fileContent.length,
        message: `File "${fileName}" has been created and is available for download.`,
      }, null, 2);
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
  {
    name: "web_search",
    description:
      "Search the web for current information on any topic. Returns top results with titles, URLs, and snippets. Use this when you need real-time data, current events, company info, or anything not in your training data.",
    example: '{"tool":"web_search","input":"YC Winter 2025 batch companies"}',
  },
  {
    name: "fetch_url",
    description:
      "Fetch and extract text content from a URL. Use this when a user shares a link or when you need to read a specific webpage. Returns the readable text content.",
    example: '{"tool":"fetch_url","input":"https://www.ycombinator.com/companies"}',
  },
  {
    name: "generate_code",
    description:
      "Generate working code in any language. Takes a description of what to build and returns complete, runnable code with comments. Use when someone asks for code, scripts, functions, or implementations.",
    example: '{"tool":"generate_code","input":"Python function to merge two sorted arrays"}',
  },
  {
    name: "analyze_data",
    description:
      "Analyze structured data (JSON, CSV, tables). Takes data and a question, returns insights, patterns, summaries, or calculations.",
    example: '{"tool":"analyze_data","input":"What are the top 3 categories by revenue? Data: [{category:\"A\",rev:100},{category:\"B\",rev:200}]"}',
  },
  {
    name: "summarize",
    description:
      "Summarize a long piece of text into key points. Takes text and returns a concise summary with bullet points.",
    example: '{"tool":"summarize","input":"Long article text here..."}',
  },
  {
    name: "translate",
    description:
      "Translate text between languages. Takes text and target language, returns the translation.",
    example: '{"tool":"translate","input":"Spanish: Hello, how are you?"}',
  },
  {
    name: "read_file",
    description:
      "Read the content of an uploaded file. Use when a user shares a file or mentions a file name. Returns the file content.",
    example: '{"tool":"read_file","input":"report.md"}',
  },
  {
    name: "generate_file",
    description:
      "Create a new file with content. Takes filename and content, creates a downloadable file. Use when the user asks you to create, write, or generate a file.",
    example: '{"tool":"generate_file","input":"summary.md|# Summary\n\nThe key findings are..."}',
  },
];

const SYSTEM_PROMPT = `You are a highly capable AI assistant working as a teammate in a shared multiplayer session. You are intelligent, resourceful, and proactive. Multiple humans are watching you work live in one chat thread.

## WHO YOU ARE
- You are a senior-level AI assistant with deep knowledge across many domains
- You think step-by-step, reason carefully, and provide thorough, accurate answers
- You are warm, conversational, and professional — like a brilliant colleague who genuinely wants to help
- You use natural language, not robotic or overly formal phrasing
- You address people by name when possible and show genuine engagement

## YOUR CAPABILITIES
You have access to these tools:
${TOOL_SPECS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

## HOW TO USE TOOLS
To call a tool, output ONLY this exact JSON on a single line (nothing else):
{"thought": "<one-line summary of what you're doing>", "tool": "<tool_name>", "input": "<query or parameters>"}

You can call multiple tools in sequence. After each tool call, you'll receive the result and can decide your next action.

## TOOL USAGE RULES
- @kb → ALWAYS call search_knowledge_base with the user's query
- @agent / @ai → You are being addressed directly. Always respond.
- When someone shares a URL → ALWAYS call fetch_url to read the content
- When someone asks to research → ALWAYS call web_search first, then fetch_url on promising results
- When someone asks for code → Call generate_code with a detailed description
- When someone shares data → Call analyze_data with the data and their question
- When someone asks to summarize → Call summarize with the text
- When someone asks to translate → Call translate with the text and target language
- NEVER say you can't do something without trying the relevant tool first

## REPLYING TO HUMANS
Write your response as natural conversational text. NEVER output JSON, code fences, or structured formats when talking to humans.

### Good examples:
Hey! I looked into that for you. The YC W25 batch has 240+ companies across AI, fintech, health, and developer tools. Here are some highlights: [specific details from research]. Want me to dive deeper into any particular category?

I found 3 relevant articles in our knowledge base about billing:
1. "Refund Policy" — Refunds are processed within 5 business days with original receipt
2. "Billing FAQ" — Common billing questions and answers
3. "Invoice Management" — How to handle invoices
Let me know which one you'd like me to explain in detail!

### Bad examples (NEVER do this):
{"reply": "Here's what I found..."}
{"message": "Let me help..."}
\`\`\`json
{"answer": "..."}
\`\`\`

## HOW TO ANSWER QUESTIONS
1. Think about what the person is really asking
2. Use tools if needed to get accurate, current information
3. Provide a clear, specific, helpful answer
4. Offer follow-up actions or ask if they need more
5. Be honest about limitations — but try everything first

## HANDLING DIFFERENT REQUESTS
- **Research questions**: Use web_search, then fetch_url on the best results. Synthesize findings into a clear summary.
- **Code requests**: Write clean, well-commented code. Explain what it does and how to use it.
- **Data analysis**: Look at the data carefully, identify patterns, provide actionable insights.
- **Knowledge base queries**: Search the KB, then explain the findings in your own words.
- **Customer support**: Be empathetic, thorough, and solution-oriented.
- **Brainstorming**: Be creative, build on others' ideas, offer multiple angles.
- **General questions**: Give direct, specific answers. No hedging or filler.

## PROPOSALS (only when making significant changes)
{"proposal": {"title": "...", "artifactType": "code|text|structured", "before": "...", "after": "..."}}

## RULES
- Answer the SPECIFIC question asked. Don't be vague or generic.
- When someone asks "what model are you" — say you're an AI assistant running on the Experiential gateway, capable of web research, code generation, data analysis, and more.
- NEVER output JSON when talking to humans
- NEVER output your internal thinking — just give the final answer
- If you don't know something, say so honestly but offer to research it
- Build on previous context — reference earlier messages when relevant
- Be concise but thorough. No filler, no fluff, but don't skip important details.`;

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
  opts: { modelOverride?: string } = {},
): Promise<{ ok: boolean; text: string }> {
  const backend = resolveModel();
  if (!backend) {
    return { ok: false, text: "No AI model configured." };
  }
  // Allow per-session model override.
  if (opts.modelOverride) backend.model = opts.modelOverride;
  const label = backend.baseUrl.includes("experiential")
    ? "experiential"
    : backend.baseUrl.includes("groq")
      ? "groq"
      : "llm";

  try {
    const res = await fetch(`${backend.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${backend.apiKey}`,
      },
      body: JSON.stringify({
        model: backend.model,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9,
      }),
    });
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

  // @kb always triggers a knowledge base search.
  const kbMatch = text.match(/@kb\s*(.*)/i);
  if (kbMatch) {
    const query = kbMatch[1].trim() || text.replace(/@kb/gi, "").trim();
    return JSON.stringify({
      thought: `Searching the knowledge base for "${truncate(query || text, 60)}"...`,
      tool: "search_knowledge_base",
      input: query || text.replace(/@\S+/g, "").trim().slice(0, 80),
    });
  }

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
  modelOverride?: string,
): Promise<{ ok: boolean; text: string }> {
  const backend = resolveModel();
  if (backend) {
    const live = await callLlm(conversation, { modelOverride });
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
  if (!text) return null;

  // Step 1: Strip code fences.
  let cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!cleaned) return null;

  // Step 2: If it looks like JSON, try to extract human text.
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    try {
      const parsed = JSON.parse(cleaned) as unknown;
      if (typeof parsed === "string") return parsed.trim();
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        // Try all common reply keys.
        for (const key of ["reply", "message", "content", "text", "response", "answer", "output", "result"]) {
          const val = obj[key];
          if (typeof val === "string" && val.trim()) return val.trim();
        }
        // Nested objects.
        for (const key of ["reply", "message", "data"]) {
          const val = obj[key];
          if (val && typeof val === "object") {
            const nested = val as Record<string, unknown>;
            for (const k of ["text", "content", "message", "reply"]) {
              if (typeof nested[k] === "string" && (nested[k] as string).trim()) return (nested[k] as string).trim();
            }
          }
        }
        // If it has a "thought" key but no reply, extract the thought.
        if (typeof obj.thought === "string" && obj.thought.trim() && !obj.tool && !obj.proposal) {
          return (obj.thought as string).trim();
        }
        // Give up on structured JSON — don't return the raw object.
        return null;
      }
    } catch {
      // Not valid JSON — fall through to text extraction.
    }
  }

  // Step 3: If it's a mixed block (JSON + prose), extract just the prose.
  // Look for text after the last closing brace.
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < cleaned.length - 1) {
    const after = cleaned.slice(lastBrace + 1).trim();
    if (after.length > 10) return after;
  }
  // Look for text before the first opening brace.
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    const before = cleaned.slice(0, firstBrace).trim();
    if (before.length > 10) return before;
  }

  // Step 4: Strip protocol prefixes and return whatever's left.
  let stripped = cleaned
    .replace(/^(?:Thought|Thought:|Tool|Reply|Response|Answer):\s*/i, "")
    .trim();

  // If it still looks like a partial JSON object, try to extract readable text.
  if (stripped.startsWith("{") && !stripped.includes("}")) {
    // Partial JSON — try to find any readable content.
    const match = stripped.match(/"(?:reply|message|content|text|thought)":\s*"([^"]+)"/);
    if (match) return match[1];
  }

  // Step 5: Strip thinking/reasoning patterns from reasoning models.
  // These models output internal reasoning before the actual answer.
  // Pattern: "The human/user is asking..." or "I should..." or "Let me..."
  stripped = stripped
    .replace(/^(?:The (?:human|user) is (?:asking|requesting|wondering|wanting)[^.]*\.\s*)/i, "")
    .replace(/^(?:I (?:should|need to|will|must|can)[^.]*\.\s*)/i, "")
    .replace(/^(?:Let me (?:think|consider|check|look|analyze|explain)[^.]*\.\s*)/i, "")
    .replace(/^(?:Based on the (?:context|conversation|question|message)[^.]*\.\s*)/i, "")
    .replace(/^(?:Since (?:the|this|they|the user|the human)[^.]*\.\s*)/i, "")
    .replace(/^(?:The (?:user|human|person|someone) (?:is|was|has|wants|needs|asked)[^.]*\.\s*)/i, "")
    .replace(/^(?:\w+ is (?:asking|requesting|wondering)[^.]*\.\s*)/i, "")
    .trim();

  // If we stripped everything and nothing's left, return null.
  if (!stripped || stripped.length < 5) return null;

  return stripped;
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
    // Read the session's selected AI model.
    const sessionForModel = await ctx.runQuery(api.sessions.getSession, { sessionId });
    const modelOverride = sessionForModel?.model ?? undefined;
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
          content: `Session timeline so far:\n${renderThread(events)}\n\nThe humans are waiting for your reply, ${AGENT_NAME}.${interruptionNote}\nWrite your response as a natural conversational message. Do NOT output JSON.`,
        });

        await ctx.runMutation(internal.sessions.internalSetActivity, {
          sessionId,
          label: `${AGENT_NAME} is thinking...`,
          state: "running",
        });

        const { ok, text } = await askModel(conversation, modelOverride);
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
          } else if (toolName === "web_search") {
            // Real web search using DuckDuckGo
            try {
              const searchResults = await webSearch(input);
              result = JSON.stringify({ results: searchResults }, null, 2);
            } catch (err) {
              result = JSON.stringify({ error: `Web search failed: ${err instanceof Error ? err.message : String(err)}` });
            }
          } else if (toolName === "fetch_url") {
            // Fetch and extract text from a URL
            try {
              const content = await fetchUrlContent(input);
              result = JSON.stringify({ content }, null, 2);
            } catch (err) {
              result = JSON.stringify({ error: `URL fetch failed: ${err instanceof Error ? err.message : String(err)}` });
            }
          } else if (toolName === "read_file") {
            // Read an uploaded file's content
            try {
              const files = (await ctx.runQuery(api.files.listSessionFiles, { sessionId })) as Array<{ name: string; content?: string; storageId: string }>;
              const file = files.find((f) => f.name === input || f.name.includes(input));
              if (file && file.content) {
                result = JSON.stringify({ content: file.content, fileName: file.name }, null, 2);
              } else if (file && file.storageId && file.storageId !== "generated") {
                // For storage files, return metadata (actual download handled client-side)
                result = JSON.stringify({ message: `File "${file.name}" found. It's stored in cloud storage. Use the download button to access it.`, fileName: file.name }, null, 2);
              } else {
                result = JSON.stringify({ error: `File "${input}" not found in this session. Available files: ${files.map((f) => f.name).join(", ") || "none"}` });
              }
            } catch (err) {
              result = JSON.stringify({ error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}` });
            }
          } else if (toolName === "generate_file") {
            // Generate a new file
            try {
              const parts = input.split("|");
              const fileName = (parts[0] || "output.txt").trim();
              const fileContent = parts.slice(1).join("|").trim() || "Generated content";
              const mimeType = fileName.endsWith(".md") ? "text/markdown"
                : fileName.endsWith(".json") ? "application/json"
                : fileName.endsWith(".csv") ? "text/csv"
                : fileName.endsWith(".py") ? "text/x-python"
                : fileName.endsWith(".js") ? "text/javascript"
                : fileName.endsWith(".ts") ? "text/typescript"
                : "text/plain";
              await ctx.runMutation(api.files.saveGeneratedFile, {
                sessionId,
                name: fileName,
                mimeType,
                size: fileContent.length,
                content: fileContent,
              });
              result = JSON.stringify({ success: true, fileName, size: fileContent.length, message: `File "${fileName}" created successfully. It's available for download in the session.` }, null, 2);
            } catch (err) {
              result = JSON.stringify({ error: `Failed to generate file: ${err instanceof Error ? err.message : String(err)}` });
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

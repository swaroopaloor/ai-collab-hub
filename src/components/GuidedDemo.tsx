import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot, Check, Copy, Eye, GitFork, History, MousePointer2,
  Pause, Play, Radio, Shield, User, Zap, Wrench, ArrowRight
} from "lucide-react";
import { Link } from "react-router";

/* ---------- single demo cursor shared across 8 steps ---------- */
const DEMO_PATH = [
  // 1 Radar: glow pulse only
  { type: "pulse", x: 0.5, y: 0.5, dur: 2000, hold: 1200 },
  // 2 Session: enter from right edge, land on first user msg, then drift down
  { type: "linear", x: 92, y: 22, dur: 700, hold: 600 },
  { type: "ease", x: 88, y: 26, dur: 500, hold: 700 },
  { type: "ease", x: 85, y: 30, dur: 400, hold: 800 },
  // 3 Interrupt: land on empty composer input
  { type: "ease", x: 60, y: 78, dur: 600, hold: 700 },
  // 4 Team memory: hover over a memory card
  { type: "ease", x: 30, y: 38, dur: 700, hold: 800 },
  // 5 Gate: move to diff, then to Approve button
  { type: "ease", x: 50, y: 30, dur: 600, hold: 600 },
  { type: "ease", x: 52, y: 58, dur: 500, hold: 700 },
  // 6 Fork: hover fork button, then a new cursor appears (different color)
  { type: "ease", x: 45, y: 65, dur: 500, hold: 600 },
  // 7 Handoff: land on away briefing
  { type: "ease", x: 20, y: 25, dur: 600, hold: 700 },
  // 8 Summary: hover the finish card
  { type: "ease", x: 50, y: 60, dur: 600, hold: 800 },
];

function DemoCursor({ color }: { color: string }) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const raf = useRef<number | null>(null);
  const t0 = useRef<number>(0);
  const path = useRef<typeof DEMO_PATH>(DEMO_PATH);
  const stepPathIdx = useRef(0);

  useEffect(() => {
    let i = 0;
    const run = () => {
      const seg = path.current[i];
      if (!seg) return;
      stepPathIdx.current = i;
      if (seg.type === "pulse") {
        setX(0);
        setY(0);
        i++;
        raf.current = window.setTimeout(run, seg.dur + seg.hold);
        return;
      }
      const start = performance.now();
      const dur = seg.dur;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        setX(seg.x + (1 - eased) * 10);
        setY(seg.y + (1 - eased) * 6);
        if (t < 1) raf.current = requestAnimationFrame(step);
        else { raf.current = window.setTimeout(run, seg.hold); }
      };
      raf.current = requestAnimationFrame(step);
      i++;
    };
    run();
    return () => {
      if (raf.current) clearTimeout(raf.current);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <>
      <div
        style={{
          position: "fixed", left: x, top: y, zIndex: 99999, pointerEvents: "none",
          transition: "left 0.05s linear, top 0.05s linear",
        }}
      >
        <div
          className="ring-2 ring-black rounded-full flex items-center justify-center"
          style={{ width: 14, height: 14, backgroundColor: color }}
        >
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-t-[5px] border-t-black border-r-[5px] border-r-transparent border-b-[5px] border-b-transparent -ml-2 -mt-2 rotate-45" />
        </div>
      </div>
      <div
        style={{
          position: "fixed", left: x + 16, top: y - 8, zIndex: 99999, pointerEvents: "none",
          fontFamily: "system-ui", fontSize: 11, fontWeight: 700, color, padding: "2px 6px",
          backgroundColor: "#fff", border: "2px solid black", borderRadius: 4,
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)", whiteSpace: "nowrap",
          transform: "translateY(-100%)",
        }}
      >
        Demo
      </div>
    </>
  );
}

/* ---------- step data ---------- */
const STEPS = [
  {
    tag: "RADAR BRIEFING",
    title: "The Radar",
    body: "One screen. Every agent session. Every teammate. Live.",
    target: "/radar",
    color: "#F59E0B",
    accent: "amber",
  },
  {
    tag: "MULTIPLAYER IN ACTION",
    title: "Shared chat room",
    body: "Humans + AI agent in the same thread. Cursors move live.",
    target: "/session/seed-chat",
    color: "#FF5C5C",
    accent: "red",
  },
  {
    tag: "INTERRUPT THE AGENT",
    title: "Interrupt mid-turn",
    body: "A human can steer the agent at any moment — no waiting.",
    target: "/session/seed-chat",
    color: "#4DA6FF",
    accent: "blue",
  },
  {
    tag: "TEAM MEMORY",
    title: "Agents remember",
    body: "The agent cites what it learned in a past session.",
    target: "/session/seed-chat",
    color: "#2ECC71",
    accent: "green",
  },
  {
    tag: "APPROVAL GATES",
    title: "Review before applying",
    body: "Proposed changes surface as diffs. Approve, reject, or edit.",
    target: "/session/seed-gate",
    color: "#B57BFF",
    accent: "purple",
  },
  {
    tag: "TIME TRAVEL",
    title: "Scrub & fork from any point",
    body: "Rewind a session, then branch a new one from exactly there.",
    target: "/session/seed-chat",
    color: "#FF9440",
    accent: "orange",
  },
  {
    tag: "HANDOFF & AWAY BRIEFING",
    title: "Continue across handoffs",
    body: "Hand off to a teammate. They see what happened while they were away.",
    target: "/session/seed-handoff",
    color: "#00C2C7",
    accent: "cyan",
  },
  {
    tag: "DONE",
    title: "That's it.",
    body: "All of it, in one product, for small teams.",
    target: "/dashboard",
    color: "#111111",
    accent: "dark",
  },
];

/* ---------- realistic mock views (no routing, no auth) ---------- */
function MockRadar() {
  const sessions = [
    { title: "Acme Corp Refund Escalation", state: "RUNNING", agent: "researches KB docs for refund policy...", age: "2d 4h", handoffs: 1, module: "Chat", code: "MGR-4412" },
    { title: "Billing API Rate Limit Fix", state: "PAUSED", agent: "awaiting gate approval", age: "12h", handoffs: 0, module: "Support", code: "BRD-7710" },
    { title: "Q3 Planning Brainstorm", state: "RUNNING", agent: "summarizing competitor notes", age: "3d 1h", handoffs: 2, module: "Chat", code: "RTA-3301" },
    { title: "Acme Corp Onboarding Review", state: "RUNNING", agent: "answers setup question", age: "4h", handoffs: 0, module: "Chat", code: "SHW-0199" },
    { title: "Feature Spec: Notifs", state: "AWAITING INPUT", agent: "waiting for driver direction", age: "28m", handoffs: 0, module: "Chat", code: "CND-9928" },
    { title: "Support Ticket #2211", state: "RUNNING", agent: "validates KB articles", age: "1d 6h", handoffs: 1, module: "Support", code: "TKT-2211" },
  ];

  const stateColors: Record<string, string> = {
    RUNNING: "#2ECC71",
    PAUSED: "#FF9440",
    "AWAITING INPUT": "#FFD500",
    DONE: "#9CA3AF",
  };

  return (
    <div className="flex flex-col h-full bg-neutral-100 px-6 py-4 border-2 border-black rounded-sm min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xl font-bold uppercase tracking-tight">Radar</div>
          <div className="text-xs text-neutral-500 mt-0.5">org-wide mission control — live</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold bg-neutral-900 text-white px-2 py-1 rounded-sm border-2 border-black">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            4 online
          </span>
          <button className="text-xs font-bold bg-neutral-900 text-white px-2 py-1 rounded-sm border-2 border-black hover:bg-neutral-800">
            View all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4">
        {sessions.map((s, i) => (
          <div
            key={i}
            className="border-2 border-black rounded-sm bg-white p-4 flex flex-col gap-2 hover:shadow-[0_4px_0_0_#000] transition-shadow cursor-pointer"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-bold truncate">{s.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 whitespace-nowrap">{s.module}</span>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-sm border-2 border-black text-white"
                style={{ backgroundColor: stateColors[s.state] }}
              >
                {s.state}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-600">
              <span className="relative flex-1 h-2 bg-neutral-200 rounded-sm overflow-hidden">
                <span
                  className="absolute inset-y-0 left-0 bg-green-400 rounded-sm animate-pulse"
                  style={{ width: "65%" }}
                />
              </span>
              <span className="text-neutral-500 truncate">{s.agent}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500 border-t-2 border-neutral-200 pt-2">
              <span className="flex items-center gap-1">
                <User className="size-3" /> {Math.floor(Math.random() * 3) + 1} in session
              </span>
              <span>{s.age} · {s.handoffs} handoff{s.handoffs !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded-sm border border-neutral-300 font-mono">{s.code}</code>
              <button className="ml-auto text-[10px] font-bold text-neutral-600 border-2 border-transparent hover:border-neutral-400 px-1.5 py-0.5 rounded-sm">
                Join
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t-2 border-black bg-white rounded-sm px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <Zap className="size-4 text-amber-500" />
          <span>Live activity</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-neutral-700"><MousePointer2 className="size-3.5" /> 12 cursors</span>
          <span className="flex items-center gap-1 text-neutral-700"><Bot className="size-3.5" /> 4 agents active</span>
        </div>
      </div>
    </div>
  );
}

function MockSession() {
  const messages = [
    { who: "Maya", isAgent: false, text: "Hey @claude — can you check why Acme's refund requests dropped last week?" },
    { who: "Claude", isAgent: true, text: "Let me pull the support ticket history and the KB article on refunds.", tool: "query_tickets(customer:acme-corp)" },
    { who: "Claude", isAgent: true, text: "Refund requests are down 34% — but only for the Team plan. Here's what I found:", tool: null },
    { who: "Jonas", isAgent: false, text: "Wait, only Team? That matches the pricing change we rolled out Tuesday." },
    { who: "Claude", isAgent: true, text: "Jonas is right — I can see the correlation. The Team plan price increase on Tuesday caused a drop in new signups for that tier." },
    { who: "Maya", isAgent: false, text: "Can you pull the exact numbers by plan?" },
    { who: "Claude", isAgent: true, text: "Pulling now.", tool: "query_signups_by_plan(days=14)" },
  ];

  const participants = [
    { name: "Maya", role: "driver", color: "#FF5C5C" },
    { name: "Jonas", role: "co-pilot", color: "#4DA6FF" },
    { name: "Claude", role: "agent", color: "#FFD500" },
  ];

  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setThinking(true), 2200);
    const u = setTimeout(() => setThinking(false), 3200);
    return () => { clearTimeout(t); clearTimeout(u); };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-sm min-w-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b-2 border-black bg-neutral-50">
        <span className="text-base font-bold uppercase tracking-tight">Acme Corp Refund Escalation</span>
        <span className="ml-auto text-xs font-bold bg-neutral-900 text-white px-2 py-0.5 rounded-sm border-2 border-black">MGR-4412</span>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="w-56 border-r-2 border-black bg-neutral-100 p-3 flex flex-col gap-2 overflow-y-auto">
          <div className="text-xs font-bold uppercase text-neutral-500 mb-1">Participants ({participants.length})</div>
          {participants.map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-black"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{p.name}</div>
                <div className="text-[10px] text-neutral-500 truncate">{p.role}</div>
              </div>
            </div>
          ))}
          <div className="mt-auto pt-2 border-t-2 border-neutral-200">
            <button className="text-xs font-bold bg-neutral-900 text-white px-2 py-1 rounded-sm border-2 border-black w-full hover:bg-neutral-800">
              Share link
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className="flex flex-col gap-1">
                {m.isAgent ? (
                  <div className="flex items-center gap-2 mb-1 ml-0">
                    <span className="text-xs font-bold text-neutral-500">{m.who}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1 mr-0">
                    <span className="text-xs font-bold text-neutral-500">{m.who}</span>
                  </div>
                )}
                <div className={`max-w-[70%] rounded-sm p-3 text-sm ${m.isAgent ? "bg-blue-50 border-2 border-blue-300 self-end" : "bg-neutral-100 border-2 border-black self-start"}`}>
                  {m.text}
                  {m.tool && <div className="mt-1 text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded-sm font-mono inline-block">{m.tool}</div>}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 border-2 border-blue-300 rounded-sm self-end">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-mono text-blue-800">Claude is researching refund trends...</span>
              </div>
            )}
          </div>
          <div className="border-t-2 border-black bg-white px-4 py-2 flex items-center gap-2 min-h-[48px]">
            <input
              type="text"
              placeholder="Send a message... (type @claude to prompt the agent)"
              className="flex-1 h-9 px-3 text-sm border-2 border-black rounded-sm bg-neutral-50 outline-none focus:bg-white transition-colors placeholder:text-neutral-400"
            />
            <button className="h-9 w-9 bg-amber-400 text-black font-bold rounded-sm border-2 border-black hover:bg-amber-300 flex items-center justify-center">
              <Zap className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockTeamMemory() {
  const [memVisible, setMemVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMemVisible(true), 900); return () => clearTimeout(t); }, []);

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-sm min-w-0 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-amber-600" />
          <span className="text-lg font-bold uppercase tracking-tight">Team Memory</span>
          <span className="text-xs text-neutral-500 font-bold">3 entries learned</span>
        </div>
        <button className="text-xs font-bold bg-neutral-900 text-white px-2 py-1 rounded-sm border-2 border-black">
          Browse all
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-300 rounded-sm mb-4">
        <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-sm text-amber-900 font-medium">Agent knowledge active</span>
      </div>

      <div className="space-y-2 overflow-y-auto flex-1">
        {[
          { tag: "customer:acme-corp", content: "Acme Corp is on Team (annual) plan since Nov 2024. Priority support. Known issue: refund requests dropping.", source: "Session #1 — Acme Refund Escalation", author: "Claude", date: "2d ago" },
          { tag: "repo:billing-service", content: "billing-service handles refund processing. Known downtime windows: Sundays 2-4am UTC.", source: "Session #3 — Q3 Planning", author: "Claude", date: "5d ago" },
          { tag: "topic:refund-policy", content: "Refund policy for Team plan: prorated, requires manager approval.", source: "Session #1 — Acme Refund Escalation", author: "Claude", date: "2d ago" },
        ].map((m, i) => (
          <div
            key={i}
            className={`border-2 border-black rounded-sm p-3 hover:shadow-[0_3px_0_0_#000] transition-shadow cursor-default ${memVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold bg-neutral-900 text-white px-1.5 py-0.5 rounded-sm">{m.tag}</span>
              <span className="text-[10px] text-neutral-400">{m.date}</span>
            </div>
            <p className="text-sm mb-1">{m.content}</p>
            <div className="flex items-center gap-2 text-[10px] text-neutral-500">
              <span className="bg-neutral-100 px-1 py-0.5 rounded-sm border border-neutral-300">from {m.source}</span>
              <span>{m.author}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockInterrupt() {
  const [showing, setShowing] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowing(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-sm min-w-0">
      <div className="border-b-2 border-black px-4 py-2 flex items-center gap-2 bg-neutral-50">
        <span className="text-base font-bold">Acme Corp Refund Escalation</span>
        <span className="ml-auto text-xs font-bold bg-amber-400 text-black px-2 py-0.5 rounded-sm border-2 border-black">LIVE</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {[
          { who: "Claude", isAgent: true, text: "Refund requests are down 34% — but only for the Team plan. Here's what I found:", tool: null },
          { who: "Claude", isAgent: true, text: "Pulling the exact numbers by plan now.", tool: "query_signups_by_plan(days=14)" },
        ].map((m, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1 ml-0">
              <span className="text-xs font-bold text-neutral-500">{m.who}</span>
            </div>
            <div className="max-w-[70%] rounded-sm p-3 text-sm bg-blue-50 border-2 border-blue-300 self-end relative">
              {m.text}
              {m.tool && <div className="mt-1 text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded-sm font-mono inline-block">{m.tool}</div>}
              <div className="absolute -top-3 -right-1 h-5 w-5 rounded-full bg-amber-400 flex items-center justify-center border-2 border-black">
                <svg viewBox="0 0 10 10" className="w-3 h-3 text-black" fill="currentColor"><path d="M5 0 L9 8 L1 8 Z" /></svg>
              </div>
            </div>
          </div>
        ))}
        {showing && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 border-2 border-amber-400 rounded-sm self-end animate-pulse">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-mono text-amber-900">Maya: Show me the data by region, not just plan</span>
          </div>
        )}
      </div>
      <div className="border-t-2 border-black bg-white px-4 py-2 flex items-center gap-2 min-h-[48px]">
        <input
          type="text"
          placeholder="Send a message... (type @claude to prompt the agent)"
          className="flex-1 h-9 px-3 text-sm border-2 border-black rounded-sm bg-neutral-50 outline-none focus:bg-white transition-colors placeholder:text-neutral-400"
        />
        <button className="h-9 w-9 bg-amber-400 text-black font-bold rounded-sm border-2 border-black hover:bg-amber-300 flex items-center justify-center">
          <Zap className="size-4" />
        </button>
      </div>
    </div>
  );
}

function MockGate() {
  const [approved, setApproved] = useState(false);

  const before = `function processRefund(orderId: string) {
  const order = db.getOrder(orderId);
  if (order.status !== "paid") {
    throw new Error("Not paid");
  }
  return refundService.refund(order.amount);
}`;

  const after = `function processRefund(orderId: string, requireApproval = false) {
  const order = db.getOrder(orderId);
  if (order.status !== "paid") {
    throw new Error("Not paid");
  }
  if (requireApproval) {
    await approvalService.request(order, "Refund requested by driver");
    return { status: "pending_approval", orderId };
  }
  return refundService.refund(order.amount);
}`;

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-sm min-w-0">
      <div className="border-b-2 border-black px-4 py-2 flex items-center gap-2 bg-neutral-50">
        <Shield className="size-5 text-purple-600" />
        <span className="text-base font-bold uppercase tracking-tight">Review Gate: Process Refund Change</span>
        <span className="ml-auto text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-sm border-2 border-black">PENDING</span>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="w-72 border-r-2 border-black bg-neutral-100 p-4 flex flex-col min-h-0">
          <div className="text-xs font-bold uppercase text-neutral-500 mb-2">Proposed by Claude</div>
          <div className="text-xs text-neutral-500 mb-1">Artifact: code · billing-service</div>
          <div className="text-xs text-neutral-600 mb-3">Before → After: added approval gate for manager review</div>
          <div className="flex-1 overflow-y-auto text-sm font-mono bg-black text-green-400 p-2 rounded-sm border-2 border-black whitespace-pre">
            {before}
          </div>
          <div className="mt-2 text-xs text-neutral-500 border-t-2 border-neutral-200 pt-2">
            <span className="text-purple-700 font-bold">3 lines added</span> · <span className="text-red-600">1 line removed</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase text-neutral-500">Diff view</div>
              <div className="flex gap-1">
                <button className="text-xs font-bold bg-neutral-900 text-white px-2 py-0.5 rounded-sm border-2 border-black">Side by side</button>
                <button className="text-xs font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-sm border-2 border-neutral-300 hover:bg-neutral-200">Inline</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <pre className="text-sm font-mono bg-black text-green-400 p-3 rounded-sm border-2 border-black whitespace-pre overflow-x-auto">
                {after}
              </pre>
            </div>
          </div>
          <div className="border-t-2 border-black bg-white px-4 py-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setApproved(true)}
              className="flex items-center gap-1.5 h-9 px-4 bg-green-500 text-white font-bold rounded-sm border-2 border-black hover:bg-green-400 transition-colors"
            >
              <Check className="size-4" /> Approve
            </button>
            <button className="flex items-center gap-1.5 h-9 px-4 bg-amber-400 text-black font-bold rounded-sm border-2 border-black hover:bg-amber-300 transition-colors">
              <Wrench className="size-4" /> Edit & approve
            </button>
            <button className="flex items-center gap-1.5 h-9 px-4 bg-red-500 text-white font-bold rounded-sm border-2 border-black hover:bg-red-400 transition-colors">
              <Shield className="size-4" /> Reject with comment
            </button>
          </div>
        </div>
      </div>
      {approved && (
        <div className="border-t-2 border-green-500 bg-green-50 px-4 py-2 text-sm text-green-900 font-bold flex items-center gap-2 animate-pulse">
          <Check className="size-5 text-green-600" /> Gate approved by Maya · session resumed
        </div>
      )}
    </div>
  );
}

function MockFork() {
  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-sm min-w-0 p-5">
      <div className="border-b-2 border-black px-4 py-2 flex items-center gap-2 bg-amber-100">
        <GitFork className="size-5 text-amber-700" />
        <span className="text-lg font-bold uppercase tracking-tight text-amber-900">Forked Branch</span>
        <span className="ml-auto text-xs font-bold bg-amber-900 text-white px-2 py-0.5 rounded-sm border-2 border-black">SESSION #211</span>
      </div>

      <div className="border-2 border-amber-500 bg-amber-50 px-3 py-2 rounded-sm mb-4 flex items-center gap-2 text-sm text-amber-900">
        <GitFork className="size-4" />
        <span>
          <strong>Forked from "Acme Corp Refund Escalation"</strong> at position 4 — the divergence point
        </span>
        <button className="ml-auto text-xs font-bold bg-amber-900 text-white px-2 py-1 rounded-sm border-2 border-black">
          View original →
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 px-2 py-1">
        {[
          { who: "Maya", text: "Can you pull the exact numbers by plan?" },
          { who: "Claude", text: "Pulling now.", tool: "query_signups_by_plan(days=14)" },
          { who: "Claude", text: "Here's a different angle — let me check regional breakdowns instead.", tool: "query_signups_by_region(days=14)" },
        ].map((m, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1 ml-0">
              <span className="text-xs font-bold text-neutral-500">{m.who}</span>
            </div>
            <div className={`max-w-[70%] rounded-sm p-3 text-sm ${m.who === "Claude" ? "bg-blue-50 border-2 border-blue-300 self-end" : "bg-neutral-100 border-2 border-black self-start"}`}>
              {m.text}
              {m.tool && <div className="mt-1 text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded-sm font-mono inline-block">{m.tool}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockHandoff() {
  const [briefingVisible, setBriefingVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setBriefingVisible(true), 700); return () => clearTimeout(t); }, []);

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-sm min-w-0 p-5">
      {briefingVisible && (
        <div className="mb-4 border-2 border-amber-500 bg-amber-50 px-4 py-3 rounded-sm flex items-start gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-amber-400 flex items-center justify-center border-2 border-black shrink-0">
            <User className="size-4 text-black" />
          </div>
          <div>
            <div className="text-sm font-bold text-amber-900 mb-1">While you were away</div>
            <div className="text-xs text-amber-800 space-y-1">
              <p><strong>3 messages</strong> exchanged · <strong>1 gate</strong> pending approval</p>
              <p>Claude researched regional breakdowns and found a 41% drop in Midwest signups.</p>
              <p>Jonas took over as driver 2h ago.</p>
            </div>
            <button className="mt-2 text-xs font-bold bg-amber-900 text-white px-2 py-1 rounded-sm border-2 border-black">
              Catch up
            </button>
          </div>
        </div>
      )}

      <div className="border-b-2 border-black px-3 py-2 flex items-center gap-2 bg-neutral-50">
        <span className="text-base font-bold uppercase tracking-tight">Acme Corp Refund Escalation</span>
        <span className="ml-auto text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-sm border-2 border-black">HANDED OFF</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 px-2 py-1">
        {[
          { who: "Jonas", text: "I'm picking up from Maya — she found the Team plan drop. Let's dig deeper." },
          { who: "Claude", text: "Understood. Jonas is now driver. Continuing research on regional data.", tool: null },
          { who: "Claude", text: "Midwest down 41%, West Coast down 12%. The pricing change hit hardest in the Midwest.", tool: "query_regional_signups(days=14)" },
        ].map((m, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1 ml-0">
              <span className="text-xs font-bold text-neutral-500">{m.who}</span>
            </div>
            <div className={`max-w-[70%] rounded-sm p-3 text-sm ${m.who === "Claude" ? "bg-blue-50 border-2 border-blue-300 self-end" : "bg-neutral-100 border-2 border-black self-start"}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t-2 border-black bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <User className="size-4" />
          <span className="font-bold">Handed off to Jonas</span>
          <span className="text-neutral-400">· 2h ago</span>
        </div>
        <div className="flex gap-2">
          <button className="text-xs font-bold bg-neutral-900 text-white px-2 py-1 rounded-sm border-2 border-black">Take control</button>
          <button className="text-xs font-bold bg-amber-400 text-black px-2 py-1 rounded-sm border-2 border-black">Resume agent</button>
        </div>
      </div>
    </div>
  );
}

function MockFinish() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-neutral-100 border-2 border-black rounded-sm p-8 text-center min-w-0">
      <div className="mb-4">
        <svg viewBox="0 0 100 100" className="w-20 h-20">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#111" strokeWidth="6" />
          <path d="M30 50 L45 65 L72 35" fill="none" stroke="#111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-2xl font-black uppercase tracking-tight mb-2">All of it.</div>
      <div className="text-lg text-neutral-700 max-w-md mb-6">
        Multiplayer sessions · shared chat with an AI agent · time travel & forks · approval gates · radar dashboard · team memory · handoffs across timezones.
      </div>
      <Link
        to="/dashboard"
        className="flex items-center gap-2 h-11 px-6 bg-amber-400 text-black font-bold rounded-sm border-2 border-black hover:bg-amber-300 transition-colors"
      >
        <ArrowRight className="size-5" /> Start building
      </Link>
    </div>
  );
}

/* ---------- guided demo ---------- */
export default function GuidedDemo() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [overlay, setOverlay] = useState(false);

  const start = useCallback(() => {
    setOverlay(true);
    setActive(true);
    setPaused(false);
  }, []);

  useEffect(() => {
    if (!active || paused || overlay) return;
    const timer = setTimeout(() => {
      if (step < 7) setStep(step + 1);
      else {
        setActive(false);
        setOverlay(false);
      }
    }, 4200);
    return () => clearTimeout(timer);
  }, [step, active, paused, overlay]);

  const stepData = STEPS[step];

  const screens: Record<string, React.ReactNode> = {
    0: <MockRadar />,
    1: <MockSession />,
    2: <MockInterrupt />,
    3: <MockTeamMemory />,
    4: <MockGate />,
    5: <MockFork />,
    6: <MockHandoff />,
    7: <MockFinish />,
  };

  return (
    <div className="relative">
      {!active && (
        <button
          onClick={start}
          className="flex items-center gap-2 h-11 px-5 bg-amber-400 text-black font-bold rounded-sm border-2 border-black hover:bg-amber-300 transition-colors text-base"
        >
          <Play className="size-5" />
          Start guided demo
        </button>
      )}

      {active && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col">
            {overlay && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 rounded-sm">
                <div className="text-center">
                  <div className="text-4xl font-black mb-3">Demo complete</div>
                  <p className="text-neutral-300 mb-4 max-w-md mx-auto">
                    Every feature, one flow. Now build your own.
                  </p>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 h-10 px-6 bg-amber-400 text-black font-bold rounded-sm border-2 border-black hover:bg-amber-300 transition-colors text-base"
                  >
                    <ArrowRight className="size-5" /> Go to dashboard
                  </Link>
                </div>
              </div>
            )}

            <div
              className={`flex flex-col border-2 border-black rounded-sm bg-white overflow-hidden ${
                overlay ? "opacity-0 pointer-events-none" : ""
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-2 border-b-2 border-black bg-neutral-50 min-h-[44px]">
                <div className="flex gap-1.5">
                  {STEPS.slice(0, 8).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setPaused(true); setStep(i); setTimeout(() => setPaused(false), 80); }}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        i === step ? "bg-black" : "bg-neutral-300"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold uppercase tracking-widest text-neutral-800 truncate">
                    {stepData.tag}
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    {stepData.title}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">
                    {Math.floor((step + 1) / 8 * 100)}%
                  </span>
                  <button
                    onClick={() => setPaused(!paused)}
                    className="flex items-center gap-1 h-7 px-2 bg-neutral-900 text-white text-xs font-bold rounded-sm border-2 border-black hover:bg-neutral-800"
                  >
                    {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  </button>
                  <button
                    onClick={() => { setActive(false); setOverlay(false); }}
                    className="text-xs font-bold text-neutral-500 hover:text-neutral-800 px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 bg-white">
                {screens[String(step)] ?? <div className="p-4">Loading demo...</div>}
              </div>

              <div className="border-t-2 border-black bg-neutral-50 px-4 py-2 flex items-center gap-4 text-xs text-neutral-600 min-h-[36px]">
                <span className="font-bold uppercase tracking-wider">{stepData.title}</span>
                <span className="text-neutral-400">{stepData.body}</span>
                {step < 7 && (
                  <Link
                    to={stepData.target}
                    className="ml-auto flex items-center gap-1.5 text-neutral-700 font-bold hover:text-black transition-colors"
                  >
                    <ArrowRight className="size-3.5" /> Try it live
                  </Link>
                )}
              </div>
            </div>

            {!paused && <DemoCursor color={stepData.color} />}
          </div>
        </div>
      )}
    </div>
  );
}

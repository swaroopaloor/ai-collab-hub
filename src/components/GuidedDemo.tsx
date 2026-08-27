import { Button } from "@/components/ui/button";
import {
  Bot,
  Clock,
  GitFork,
  MessageSquare,
  Play,
  Radio,
  Shield,
  SkipForward,
  Square,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ── Demo data ──────────────────────────────────────────────────────────── */

const MOCK_SESSIONS = [
  { id: "s1", title: "Acme Corp Refund Escalation", state: "running", agents: 1, humans: 2, color: "#4DA6FF", activity: "searching KB for refund policy..." },
  { id: "s2", title: "Billing API Rate Limit Fix", state: "paused", agents: 1, humans: 1, color: "#FFD400", activity: "awaiting review: rate-limit PR" },
  { id: "s3", title: "Q3 Planning Brainstorm", state: "running", agents: 1, humans: 1, color: "#2ECC71", activity: "synthesizing priorities doc..." },
  { id: "s4", title: "Feature Spec: Notifications", state: "awaiting_input", agents: 1, humans: 0, color: "#B57BFF", activity: "waiting for team input" },
  { id: "s5", title: "Onboarding Flow Redesign", state: "running", agents: 1, humans: 3, color: "#FF9440", activity: "comparing onboarding variants..." },
  { id: "s6", title: "Customer: Meridian Health", state: "done", agents: 1, humans: 1, color: "#00C2C7", activity: "completed" },
];

const MOCK_CHAT = [
  { type: "human", name: "Sarah", color: "#FF5C5C", text: "@agent can you pull up the Acme refund policy from our knowledge base?" },
  { type: "thought", text: "Sarah is researching the Acme refund policy..." },
  { type: "tool", tool: "search_knowledge_base", args: "{ query: \"Acme Corp refund policy\" }", result: "Found: Acme Corp has a 30-day refund policy for Enterprise tier. Escalation needed for >30 days." },
  { type: "agent", text: "Found it — Acme Corp is on the Enterprise tier with a 30-day refund window. Their last purchase was 22 days ago, so a standard refund applies. No escalation needed.", promptedBy: "Sarah" },
  { type: "memory", text: "I also recalled from Session #12 that Acme Corp prefers email communication over calls.", citedFrom: "Session #12 — Acme Onboarding" },
  { type: "human", name: "Marcus", color: "#4DA6FF", text: "Actually hold on — they asked for a partial refund on the add-on bundle, not the base subscription. Check if that changes anything." },
  { type: "thought", text: "Marcus redirected the investigation — adapting to partial refund scope..." },
  { type: "tool", tool: "search_knowledge_base", args: "{ query: \"partial refund add-on bundle policy\" }", result: "Found: Add-on bundle refunds are prorated. Acme's bundle: $240/mo, purchased 15 days ago → $120 refundable." },
  { type: "agent", text: "Good catch — for the add-on bundle, it's a prorated refund. Since the bundle is $240/mo and they're 15 days in, that's $120 refundable. Want me to draft the approval gate for this?", promptedBy: "Marcus" },
];

const MOCK_GATE = {
  title: "Refund approval: Acme Corp add-on bundle — $120",
  artifactType: "code",
  before: `// RefundPolicy.ts
export function calculateRefund(purchase: Purchase) {
  if (purchase.isWithin30Days()) {
    return purchase.total;  // Full refund
  }
  return 0;  // No refund
}`,
  after: `// RefundPolicy.ts
export function calculateRefund(purchase: Purchase) {
  if (purchase.isWithin30Days()) {
    return purchase.total;  // Full refund
  }
  if (purchase.hasAddOnBundle() && purchase.isProratable()) {
    const daysRemaining = purchase.daysRemainingInMonth();
    return (purchase.addOnCost / 30) * daysRemaining;
  }
  return 0;  // No refund
}`,
};

const MOCK_TIMELINE = [
  { seq: 1, label: "Session started", type: "start" },
  { seq: 2, label: "Sarah joined", type: "join" },
  { seq: 3, label: "Marcus joined", type: "join" },
  { seq: 4, label: "@agent — pull up refund policy", type: "human" },
  { seq: 5, label: "Agent: searched KB, found policy", type: "agent" },
  { seq: 6, label: "Marcus: partial refund redirect", type: "human" },
  { seq: 7, label: "Agent: recalculated prorated amount", type: "agent" },
  { seq: 8, label: "Agent: proposed refund gate", type: "proposal" },
];

/* ── Step definitions ───────────────────────────────────────────────────── */

type Step = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Play;
  color: string;
  durationMs: number;
};

const STEPS: Step[] = [
  { id: "radar", title: "Org-Wide Radar", subtitle: "Every active session, one glance", icon: Radio, color: "#2ECC71", durationMs: 5500 },
  { id: "session", title: "Live Collaboration", subtitle: "Humans + AI agent in one thread", icon: Users, color: "#4DA6FF", durationMs: 7000 },
  { id: "memory", title: "Team Memory", subtitle: "Agent cites knowledge from past sessions", icon: Bot, color: "#B57BFF", durationMs: 4500 },
  { id: "interrupt", title: "Interrupt & Redirect", subtitle: "Mid-turn — the agent adapts instantly", icon: Zap, color: "#FFD400", durationMs: 5000 },
  { id: "gate", title: "Approval Gate", subtitle: "Review proposed changes with live diff", icon: Shield, color: "#FF9440", durationMs: 5500 },
  { id: "timetravel", title: "Time Travel & Fork", subtitle: "Scrub back, branch a new path", icon: GitFork, color: "#FF5C5C", durationMs: 6000 },
  { id: "handoff", title: "Handoff & Away Briefing", subtitle: "Cross-timezone teamwork, no context lost", icon: Clock, color: "#00C2C7", durationMs: 5000 },
  { id: "finish", title: "All Together", subtitle: "One screen — your team + AI, everywhere", icon: Radio, color: "#2ECC71", durationMs: 4000 },
];

/* ── Smooth cursor ──────────────────────────────────────────────────────── */

type Waypoint = { x: number; y: number; easeMs: number };

const CURSOR_PATHS: Record<string, Waypoint[]> = {
  session: [
    { x: 25, y: 20, easeMs: 800 },
    { x: 30, y: 25, easeMs: 600 },
    { x: 28, y: 22, easeMs: 400 },
    { x: 40, y: 35, easeMs: 700 },
    { x: 42, y: 33, easeMs: 500 },
    { x: 35, y: 28, easeMs: 600 },
  ],
  memory: [
    { x: 32, y: 30, easeMs: 600 },
    { x: 35, y: 32, easeMs: 500 },
    { x: 30, y: 25, easeMs: 700 },
    { x: 38, y: 28, easeMs: 500 },
  ],
  interrupt: [
    { x: 45, y: 40, easeMs: 500 },
    { x: 20, y: 18, easeMs: 800 },
    { x: 22, y: 20, easeMs: 400 },
    { x: 50, y: 45, easeMs: 700 },
    { x: 48, y: 42, easeMs: 400 },
  ],
  gate: [
    { x: 55, y: 50, easeMs: 600 },
    { x: 60, y: 48, easeMs: 500 },
    { x: 58, y: 55, easeMs: 500 },
  ],
};

function Cursor({ active, stepId }: { active: boolean; stepId: string }) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [label, setLabel] = useState("Sarah");
  const [visible, setVisible] = useState(false);
  const frameRef = useRef<number>(0);
  const stateRef = useRef({ wpIdx: 0, startX: 50, startY: 50, elapsed: 0, lastTime: 0 });

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const paths = CURSOR_PATHS[stepId];
    if (!paths || paths.length === 0) {
      setVisible(false);
      return;
    }

    const s = stateRef.current;
    s.wpIdx = 0;
    s.startX = pos.x;
    s.startY = pos.y;
    s.elapsed = 0;
    s.lastTime = performance.now();
    setVisible(true);

    if (stepId === "interrupt") setLabel("Marcus");
    else setLabel("Sarah");

    function tick(now: number) {
      const dt = now - s.lastTime;
      s.lastTime = now;
      s.elapsed += dt;

      const wp = paths[s.wpIdx];
      const progress = Math.min(s.elapsed / wp.easeMs, 1);
      // Ease-out cubic for natural deceleration
      const ease = 1 - Math.pow(1 - progress, 3);

      const x = s.startX + (wp.x - s.startX) * ease;
      const y = s.startY + (wp.y - s.startY) * ease;
      setPos({ x, y });

      if (progress >= 1) {
        s.startX = wp.x;
        s.startY = wp.y;
        s.wpIdx = (s.wpIdx + 1) % paths.length;
        s.elapsed = 0;
      }
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, stepId]);

  if (!visible) return null;
  return (
    <div
      className="pointer-events-none fixed z-[10001]"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transition: "none",
        willChange: "transform",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF5C5C" stroke="#111" strokeWidth="1.5">
        <path d="M4 2 L20 12 L12 13 L9 21 Z" />
      </svg>
      <span className="nb-border absolute top-5 left-5 whitespace-nowrap rounded-none bg-[#FF5C5C] px-1.5 py-0.5 text-[10px] font-bold text-black">
        {label}
      </span>
    </div>
  );
}

/* ── Mock screens ───────────────────────────────────────────────────────── */

function RadarScreen() {
  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-4 flex items-center gap-3">
        <Radio className="size-5 text-[#2ECC71]" />
        <h2 className="text-lg font-black uppercase tracking-tight">Radar — Org Dashboard</h2>
        <span className="nb-border ml-auto bg-[#2ECC71] px-2 py-0.5 text-[10px] font-black text-black">6 SESSIONS</span>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-3">
        {MOCK_SESSIONS.map((s) => (
          <div key={s.id} className="nb-border nb-lift flex flex-col bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="nb-border inline-block size-2" style={{ background: s.color }} />
              <span className="truncate text-xs font-black">{s.title}</span>
            </div>
            <span className={`nb-border mb-2 inline-block self-start px-1.5 py-0.5 text-[9px] font-bold uppercase ${
              s.state === "running" ? "bg-[#2ECC71] text-black" :
              s.state === "paused" ? "bg-[#FFD400] text-black" :
              s.state === "awaiting_input" ? "bg-[#FF9440] text-black" :
              "bg-muted text-muted-foreground"
            }`}>{s.state.replace("_", " ")}</span>
            <p className="mb-2 text-[10px] text-muted-foreground">{s.activity}</p>
            <div className="mt-auto flex items-center gap-1">
              <div className="flex -space-x-1">
                {Array.from({ length: s.humans }).map((_, i) => (
                  <span key={i} className="nb-border inline-block size-4 rounded-full bg-[#4DA6FF] text-center text-[8px] font-bold leading-4 text-black">
                    {String.fromCharCode(65 + i)}
                  </span>
                ))}
              </div>
              <span className="ml-1 text-[9px] text-muted-foreground">{s.humans} online</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionScreen({ phase }: { phase: "chat" | "memory" | "interrupt" }) {
  const visibleMessages = phase === "chat" ? MOCK_CHAT.slice(0, 5) :
    phase === "memory" ? MOCK_CHAT.slice(0, 6) :
    MOCK_CHAT.slice(0, 8);

  return (
    <div className="flex h-full w-full bg-background">
      {/* Sidebar */}
      <div className="hidden w-48 shrink-0 border-r-2 border-foreground/20 bg-card p-3 md:block">
        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Participants</p>
        <div className="space-y-1.5">
          {[
            { name: "Sarah", role: "driver", color: "#FF5C5C" },
            { name: "Marcus", role: "co-pilot", color: "#4DA6FF" },
            { name: "Agent", role: "ai", color: "#2ECC71" },
          ].map((p) => (
            <div key={p.name} className="nb-border flex items-center gap-1.5 bg-background px-2 py-1">
              <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
              <span className="text-[10px] font-bold">{p.name}</span>
              <span className="ml-auto text-[8px] text-muted-foreground uppercase">{p.role}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 nb-border bg-background p-2">
          <p className="text-[9px] font-black uppercase text-muted-foreground">Agent Status</p>
          <p className="mt-1 text-[10px] text-[#2ECC71]">● Active</p>
        </div>
      </div>
      {/* Main chat */}
      <div className="flex flex-1 flex-col">
        <div className="nb-border flex items-center gap-2 border-x-0 border-t-0 bg-card px-4 py-2">
          <span className="nb-border bg-[#4DA6FF] px-1.5 py-0.5 text-[10px] font-black text-black">CHAT</span>
          <span className="text-xs font-black">Acme Corp Refund Escalation</span>
          <span className="nb-border ml-auto bg-[#2ECC71] px-1.5 py-0.5 text-[9px] font-bold text-black">RUNNING</span>
        </div>
        <div className="flex-1 space-y-2 overflow-auto p-4">
          {visibleMessages.map((m, i) => {
            if (m.type === "human") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[70%] nb-border bg-card p-2">
                    <p className="mb-0.5 text-[9px] font-black" style={{ color: m.color }}>{m.name}</p>
                    <p className="text-[11px] leading-relaxed">{m.text}</p>
                  </div>
                </div>
              );
            }
            if (m.type === "agent") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[70%] nb-border bg-[#2ECC71]/10 p-2">
                    <p className="mb-0.5 text-[9px] font-black text-[#2ECC71]">Agent</p>
                    <p className="text-[11px] leading-relaxed">{m.text}</p>
                    <p className="mt-1 text-[8px] text-muted-foreground">prompted by @{m.promptedBy}</p>
                  </div>
                </div>
              );
            }
            if (m.type === "thought") {
              return (
                <div key={i} className="flex justify-center">
                  <div className="nb-border bg-[#FFD400]/15 px-3 py-1 text-center text-[10px] italic text-muted-foreground">
                    <Sparkles className="mr-1 inline size-3 text-[#FFD400]" />
                    {m.text}
                  </div>
                </div>
              );
            }
            if (m.type === "tool") {
              return (
                <div key={i} className="flex justify-center">
                  <div className="nb-border max-w-[80%] bg-muted p-2">
                    <p className="mb-0.5 text-[9px] font-black text-[#FF9440]">⚙ {m.tool}</p>
                    <pre className="whitespace-pre-wrap text-[9px] text-muted-foreground">{m.args}</pre>
                    <pre className="mt-1 whitespace-pre-wrap text-[9px] text-[#2ECC71]">{m.result}</pre>
                  </div>
                </div>
              );
            }
            if (m.type === "memory") {
              return (
                <div key={i} className="flex justify-center">
                  <div className="nb-border max-w-[70%] border-[#B57BFF] bg-[#B57BFF]/10 p-2">
                    <p className="mb-0.5 text-[9px] font-black text-[#B57BFF]">
                      <Bot className="mr-1 inline size-3" />
                      Team Memory
                    </p>
                    <p className="text-[11px] leading-relaxed">{m.text}</p>
                    <a className="mt-1 inline-block text-[8px] font-bold text-[#B57BFF] underline">
                      from {m.citedFrom} →
                    </a>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
        {/* Composer */}
        <div className="nb-border border-x-0 border-b-0 bg-card px-4 py-2">
          <div className="nb-border flex bg-background px-3 py-2 text-[11px] text-muted-foreground">
            Type a message or @agent to prompt...
          </div>
        </div>
      </div>
    </div>
  );
}

function GateScreen() {
  const [approved, setApproved] = useState(false);
  const beforeLines = MOCK_GATE.before.split("\n");
  const afterLines = MOCK_GATE.after.split("\n");

  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="size-5 text-[#FF9440]" />
        <h2 className="text-lg font-black uppercase tracking-tight">Approval Gate</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Agent proposed a change — review before it goes live</p>
      <div className="nb-border mb-3 bg-card p-3">
        <p className="text-xs font-black">{MOCK_GATE.title}</p>
        <span className="nb-border mt-1 inline-block bg-[#FF9440] px-1.5 py-0.5 text-[9px] font-bold text-black uppercase">
          {approved ? "Approved" : "Pending Review"}
        </span>
      </div>
      <div className="nb-border flex-1 overflow-auto bg-card">
        <div className="grid h-full grid-cols-2 divide-x-2 divide-foreground/20">
          <div className="p-3">
            <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">Before</p>
            <pre className="text-[10px] leading-4">
              {beforeLines.map((line, i) => (
                <div key={i} className="bg-[#FF5C5C]/8 px-1 text-[#FF5C5C]/70">
                  <span className="inline-block w-4 text-right text-muted-foreground/50">{i + 1}</span> {line}
                </div>
              ))}
            </pre>
          </div>
          <div className="p-3">
            <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">After</p>
            <pre className="text-[10px] leading-4">
              {afterLines.map((line, i) => (
                <div key={i} className="bg-[#2ECC71]/8 px-1 text-[#2ECC71]/80">
                  <span className="inline-block w-4 text-right text-muted-foreground/50">{i + 1}</span> {line}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
      {!approved && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={() => setApproved(true)}
            className="nb-border nb-lift h-8 bg-[#2ECC71] px-3 text-[10px] font-black text-black"
          >
            ✓ Approve
          </Button>
          <Button className="nb-border h-8 bg-card px-3 text-[10px] font-bold">
            ✏ Edit &amp; Approve
          </Button>
          <Button className="nb-border h-8 bg-[#FF5C5C] px-3 text-[10px] font-bold text-black">
            ✕ Reject
          </Button>
          <span className="ml-auto text-[9px] text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-[#2ECC71] mr-1" />
            Sarah is reviewing
          </span>
        </div>
      )}
    </div>
  );
}

function TimeTravelScreen() {
  const [scrubPos, setScrubPos] = useState(100);
  const [forked, setForked] = useState(false);
  const scrubberRef = useRef<HTMLDivElement>(null);

  // Auto-animate scrubber backwards then show fork button
  useEffect(() => {
    if (forked) return;
    let frame: number;
    let start = performance.now();
    const duration = 3000;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      // Ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setScrubPos(100 - ease * 65); // scrub from 100% to 35%
      if (t < 1) frame = requestAnimationFrame(tick);
      else {
        // After scrub completes, auto-fork
        setTimeout(() => setForked(true), 800);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [forked]);

  const visibleEvents = MOCK_TIMELINE.filter(
    (_, i) => i < Math.floor((scrubPos / 100) * MOCK_TIMELINE.length)
  );

  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-3 flex items-center gap-2">
        <GitFork className="size-5 text-[#FF5C5C]" />
        <h2 className="text-lg font-black uppercase tracking-tight">Time Travel</h2>
        {forked && (
          <span className="nb-border ml-2 bg-[#B57BFF] px-2 py-0.5 text-[10px] font-black text-black">
            NEW FORK CREATED
          </span>
        )}
      </div>

      {forked ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="nb-border mb-4 bg-[#B57BFF]/10 p-4 text-center">
            <GitFork className="mx-auto mb-2 size-8 text-[#B57BFF]" />
            <p className="text-sm font-black">Forked from Acme Corp Refund Escalation</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              at event 5 of 8 — new session ready for fresh agent run
            </p>
          </div>
          <div className="nb-border flex gap-2">
            <span className="nb-border bg-[#FF5C5C] px-2 py-0.5 text-[9px] font-bold text-black">FORK</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="nb-border bg-[#4DA6FF] px-2 py-0.5 text-[9px] font-bold text-black">INDEPENDENT SESSION</span>
          </div>
        </div>
      ) : (
        <>
          {/* Mini timeline */}
          <div className="nb-border mb-4 flex-1 overflow-auto bg-card p-3">
            <div className="space-y-1">
              {MOCK_TIMELINE.map((ev, i) => {
                const threshold = ((i + 1) / MOCK_TIMELINE.length) * 100;
                const visible = scrubPos >= threshold;
                return (
                  <div
                    key={ev.seq}
                    className={`flex items-center gap-2 px-2 py-1 text-[10px] transition-opacity duration-300 ${
                      visible ? "opacity-100" : "opacity-20"
                    }`}
                  >
                    <span className="nb-border inline-block size-1.5" style={{
                      background: ev.type === "agent" ? "#2ECC71" :
                        ev.type === "human" ? "#4DA6FF" :
                        ev.type === "proposal" ? "#FF9440" : "#999"
                    }} />
                    <span className="font-bold">#{ev.seq}</span>
                    <span className="text-muted-foreground">{ev.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Scrubber */}
          <div className="nb-border bg-card p-3">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-black">
              <span className="text-[#FF5C5C]">TIME TRAVEL</span>
              <span className="text-muted-foreground">— position {Math.round(scrubPos)}%</span>
            </div>
            <div ref={scrubberRef} className="relative h-3 w-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-[#FF5C5C]"
                style={{ width: `${scrubPos}%` }}
              />
              <div
                className="nb-border absolute top-1/2 size-4 -translate-y-1/2 bg-[#FFD400]"
                style={{ left: `calc(${scrubPos}% - 8px)` }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground">
                Event {visibleEvents.length} / {MOCK_TIMELINE.length}
              </span>
              <span className="nb-border bg-[#FF5C5C] px-1.5 py-0.5 text-[9px] font-bold text-black">
                ⏪ Rewinding...
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HandoffScreen() {
  return (
    <div className="flex h-full w-full flex-col bg-background p-6">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="size-5 text-[#00C2C7]" />
        <h2 className="text-lg font-black uppercase tracking-tight">Handoff &amp; Away Briefing</h2>
      </div>
      <div className="nb-border mb-4 bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="nb-border bg-[#00C2C7] px-2 py-0.5 text-[10px] font-black text-black">HANDED OFF</span>
          <span className="text-[10px] text-muted-foreground">2 hours ago by Sarah → Marcus</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          "Picking up where I left off — we calculated the $120 prorated refund for Acme's add-on bundle.
          Approval gate is pending. Customer prefers email."
        </p>
      </div>
      <div className="nb-border bg-[#FFD400]/10 p-4">
        <p className="mb-2 text-xs font-black text-[#FFD400]">📧 While you were away</p>
        <div className="space-y-1.5">
          <div className="flex items-start gap-2 text-[10px]">
            <span className="mt-0.5 inline-block size-1.5 shrink-0 bg-[#2ECC71]" />
            <span>Agent completed KB search for "partial refund add-on bundle policy"</span>
          </div>
          <div className="flex items-start gap-2 text-[10px]">
            <span className="mt-0.5 inline-block size-1.5 shrink-0 bg-[#2ECC71]" />
            <span>Agent saved team memory: "Acme Corp refund = $120 prorated add-on bundle"</span>
          </div>
          <div className="flex items-start gap-2 text-[10px]">
            <span className="mt-0.5 inline-block size-1.5 shrink-0 bg-[#FF9440]" />
            <span className="font-bold">1 approval gate pending your review</span>
          </div>
          <div className="flex items-start gap-2 text-[10px]">
            <span className="mt-0.5 inline-block size-1.5 shrink-0 bg-[#4DA6FF]" />
            <span>Marcus joined as co-pilot (handoff from Sarah)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinishScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background p-6">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-black uppercase tracking-tight">Your Team + AI, Live</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Multiplayer sessions that run continuously across handoffs, with live presence,
          time travel, approval gates, and shared memory — the way agent work should be.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Live Sessions", value: "6", color: "#2ECC71" },
          { label: "Team Members", value: "4", color: "#4DA6FF" },
          { label: "Memories Saved", value: "12", color: "#B57BFF" },
        ].map((s) => (
          <div key={s.label} className="nb-border bg-card p-4 text-center">
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function GuidedDemo() {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const currentStep = STEPS[stepIdx];

  // Auto-advance
  useEffect(() => {
    if (!active || paused || !currentStep) return;
    timerRef.current = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
      else {
        setActive(false);
        setStepIdx(0);
      }
    }, currentStep.durationMs);
    return () => clearTimeout(timerRef.current);
  }, [active, paused, stepIdx, currentStep]);

  const startDemo = useCallback(() => {
    setActive(true);
    setStepIdx(0);
    setPaused(false);
  }, []);

  const skipToStep = useCallback((idx: number) => {
    setStepIdx(idx);
    setPaused(false);
  }, []);

  const nextStep = useCallback(() => {
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    else {
      setActive(false);
      setStepIdx(0);
    }
  }, [stepIdx]);

  const endDemo = useCallback(() => {
    setActive(false);
    setStepIdx(0);
    setPaused(false);
  }, []);

  // Render the current mock screen
  function renderScreen() {
    if (!currentStep) return null;
    switch (currentStep.id) {
      case "radar": return <RadarScreen />;
      case "session": return <SessionScreen phase="chat" />;
      case "memory": return <SessionScreen phase="memory" />;
      case "interrupt": return <SessionScreen phase="interrupt" />;
      case "gate": return <GateScreen />;
      case "timetravel": return <TimeTravelScreen />;
      case "handoff": return <HandoffScreen />;
      case "finish": return <FinishScreen />;
      default: return null;
    }
  }

  // Trigger button on landing page
  if (!active) {
    return (
      <Button
        onClick={startDemo}
        className="nb-border nb-lift h-12 bg-[#2ECC71] px-6 text-base font-black text-black"
      >
        <Play className="mr-2 size-4" />
        Start guided demo
      </Button>
    );
  }

  // Active demo: full-screen immersive overlay
  return (
    <>
      <Cursor active={active} stepId={currentStep?.id ?? ""} />

      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-[10000] flex flex-col bg-background">
        {/* Top bar: step label */}
        <div className="nb-border flex items-center gap-3 border-x-0 border-t-0 bg-card px-4 py-2 sm:px-6">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => skipToStep(i)}
                className="nb-border size-3 transition-all"
                style={{
                  background: i <= stepIdx ? s.color : "transparent",
                  transform: i === stepIdx ? "scale(1.3)" : "scale(1)",
                }}
                title={s.title}
              />
            ))}
          </div>

          {currentStep && (
            <div className="flex items-center gap-2">
              <currentStep.icon className="size-4 shrink-0" style={{ color: currentStep.color }} />
              <div>
                <p className="text-xs font-black uppercase">{currentStep.title}</p>
                <p className="text-[10px] text-muted-foreground">{currentStep.subtitle}</p>
              </div>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setPaused(!paused)}
              className="nb-border h-7 bg-secondary px-2 text-[10px] font-bold"
            >
              {paused ? <><Play className="size-3" /> Resume</> : <><Square className="size-3" /> Pause</>}
            </Button>
            <Button
              size="sm"
              onClick={nextStep}
              className="nb-border h-7 bg-primary px-2 text-[10px] font-black text-black"
            >
              <SkipForward className="size-3" /> Next
            </Button>
            <Button
              size="sm"
              onClick={endDemo}
              variant="outline"
              className="nb-border h-7 bg-card px-2 text-[10px] font-bold"
            >
              ✕ End
            </Button>
          </div>
        </div>

        {/* Screen content */}
        <div className="flex-1 overflow-hidden">{renderScreen()}</div>
      </div>
    </>
  );
}

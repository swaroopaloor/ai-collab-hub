import { Button } from "@/components/ui/button";
import {
  Bot,
  Clock,
  Eye,
  GitFork,
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
  { id: "s1", title: "Acme Corp Refund Escalation", state: "running", humans: 2, color: "#4DA6FF", activity: "searching KB for refund policy..." },
  { id: "s2", title: "Billing API Rate Limit Fix", state: "paused", humans: 1, color: "#FFD400", activity: "awaiting review: rate-limit PR" },
  { id: "s3", title: "Q3 Planning Brainstorm", state: "running", humans: 1, color: "#2ECC71", activity: "synthesizing priorities doc..." },
  { id: "s4", title: "Feature Spec: Notifications", state: "awaiting_input", humans: 0, color: "#B57BFF", activity: "waiting for team input" },
  { id: "s5", title: "Onboarding Flow Redesign", state: "running", humans: 3, color: "#FF9440", activity: "comparing onboarding variants..." },
  { id: "s6", title: "Customer: Meridian Health", state: "done", humans: 1, color: "#00C2C7", activity: "completed — resolved" },
];

const MOCK_CHAT = [
  { type: "human", name: "Sarah Chen", color: "#FF5C5C", text: "@agent, can you pull up the Acme refund policy from our knowledge base?" },
  { type: "thought", text: "Sarah is researching the Acme refund policy..." },
  { type: "tool", tool: "search_knowledge_base", args: '{ "query": "Acme Corp refund policy" }', result: "Found: Acme Corp is on Enterprise tier with a 30-day refund window. Last purchase was 22 days ago." },
  { type: "agent", text: "Found it. Acme Corp is on the Enterprise tier with a 30-day refund window. Their last purchase was 22 days ago, so a standard refund applies. No escalation needed.", promptedBy: "Sarah Chen" },
  { type: "memory", text: "I also recalled from Session #12 that Acme Corp prefers email over phone calls.", citedFrom: "Session #12 — Acme Onboarding" },
  { type: "human", name: "Marcus Webb", color: "#4DA6FF", text: "Hold on — they actually asked for a partial refund on the add-on bundle, not the base subscription. Check if that changes anything." },
  { type: "thought", text: "Marcus redirected the investigation — adapting to partial refund scope..." },
  { type: "tool", tool: "search_knowledge_base", args: '{ "query": "partial refund add-on bundle policy" }', result: "Found: Add-on bundle refunds are prorated. Acme bundle: $240/mo, 15 days in → $120 refundable." },
  { type: "agent", text: "Good catch — for the add-on bundle it's prorated. $240/mo, 15 days in = $120 refundable. Want me to draft the approval gate?", promptedBy: "Marcus Webb" },
];

const MOCK_GATE = {
  title: "Refund approval: Acme Corp add-on bundle — $120 prorated",
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
  { seq: 2, label: "Sarah Chen joined", type: "join" },
  { seq: 3, label: "Marcus Webb joined", type: "join" },
  { seq: 4, label: "@agent — pull up refund policy", type: "human" },
  { seq: 5, label: "Agent: searched KB, found policy", type: "agent" },
  { seq: 6, label: "Marcus: partial refund redirect", type: "human" },
  { seq: 7, label: "Agent: recalculated prorated amount", type: "agent" },
  { seq: 8, label: "Agent: proposed refund approval gate", type: "proposal" },
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
  { id: "session", title: "Live Collaboration", subtitle: "Humans + AI agent in one shared thread", icon: Users, color: "#4DA6FF", durationMs: 7000 },
  { id: "memory", title: "Team Memory", subtitle: "Agent cites knowledge from past sessions", icon: Bot, color: "#B57BFF", durationMs: 4500 },
  { id: "interrupt", title: "Interrupt & Redirect", subtitle: "Mid-turn — the agent adapts instantly", icon: Zap, color: "#FFD400", durationMs: 5000 },
  { id: "gate", title: "Approval Gate", subtitle: "Review proposed changes with a live diff", icon: Shield, color: "#FF9440", durationMs: 6000 },
  { id: "timetravel", title: "Time Travel & Fork", subtitle: "Scrub back, branch a new path", icon: GitFork, color: "#FF5C5C", durationMs: 6000 },
  { id: "handoff", title: "Handoff & Away Briefing", subtitle: "Cross-timezone teamwork, zero context lost", icon: Clock, color: "#00C2C7", durationMs: 5000 },
  { id: "finish", title: "All Together", subtitle: "One screen — your team + AI, everywhere", icon: Radio, color: "#2ECC71", durationMs: 4000 },
];

/* ── Smooth cursor with natural bezier movement ─────────────────────────── */

type Waypoint = { x: number; y: number; durationMs: number };

const CURSOR_PATHS: Record<string, Waypoint[]> = {
  session: [
    { x: 22, y: 18, durationMs: 900 },
    { x: 26, y: 24, durationMs: 650 },
    { x: 24, y: 21, durationMs: 450 },
    { x: 38, y: 32, durationMs: 800 },
    { x: 40, y: 30, durationMs: 550 },
    { x: 34, y: 26, durationMs: 650 },
  ],
  memory: [
    { x: 30, y: 28, durationMs: 650 },
    { x: 33, y: 31, durationMs: 550 },
    { x: 28, y: 24, durationMs: 750 },
    { x: 36, y: 27, durationMs: 550 },
  ],
  interrupt: [
    { x: 42, y: 38, durationMs: 550 },
    { x: 18, y: 16, durationMs: 900 },
    { x: 20, y: 19, durationMs: 450 },
    { x: 46, y: 42, durationMs: 800 },
    { x: 44, y: 39, durationMs: 450 },
  ],
  gate: [
    { x: 52, y: 48, durationMs: 650 },
    { x: 56, y: 45, durationMs: 550 },
    { x: 54, y: 52, durationMs: 550 },
  ],
};

function Cursor({ active, stepId }: { active: boolean; stepId: string }) {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [label, setLabel] = useState("Sarah Chen");
  const [visible, setVisible] = useState(false);
  const frameRef = useRef<number>(0);
  const stateRef = useRef({
    wpIdx: 0,
    startX: 50,
    startY: 50,
    elapsed: 0,
    lastTime: 0,
    initialized: false,
    lastStepId: "",
  });

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
    if (!s.initialized || stepId !== s.lastStepId) {
      s.startX = 50;
      s.startY = 50;
      s.lastStepId = stepId;
      s.initialized = true;
    }
    s.wpIdx = 0;
    s.elapsed = 0;
    s.lastTime = performance.now();
    setVisible(true);

    if (stepId === "interrupt") setLabel("Marcus Webb");
    else setLabel("Sarah Chen");

    function tick(now: number) {
      const dt = now - s.lastTime;
      s.lastTime = now;
      s.elapsed += dt;

      const wp = paths[s.wpIdx];
      const t = Math.min(s.elapsed / wp.durationMs, 1);
      const ease = 1 - Math.pow(1 - t, 4);

      const x = s.startX + (wp.x - s.startX) * ease;
      const y = s.startY + (wp.y - s.startY) * ease;
      setPos({ x, y });

      if (t >= 1) {
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
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, willChange: "left, top" }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#FF5C5C" stroke="#111" strokeWidth="1.5">
        <path d="M4 2 L20 12 L12 13 L9 21 Z" />
      </svg>
      <span className="nb-border absolute top-5 left-5 whitespace-nowrap bg-[#FF5C5C] px-2.5 py-1 text-sm font-bold text-black">
        {label}
      </span>
    </div>
  );
}

/* ── Mock screens ───────────────────────────────────────────────────────── */

function RadarScreen() {
  return (
    <div className="flex h-full w-full flex-col bg-background p-8">
      <div className="mb-6 flex items-center gap-3">
        <Radio className="size-6 text-[#2ECC71]" />
        <h2 className="text-2xl font-black uppercase tracking-tight">Radar — Org Dashboard</h2>
        <span className="nb-border ml-auto bg-[#2ECC71] px-3 py-1 text-sm font-black text-black">6 SESSIONS</span>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_SESSIONS.map((s) => (
          <div key={s.id} className="nb-border nb-lift flex flex-col bg-card p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="nb-border inline-block size-3" style={{ background: s.color }} />
              <span className="truncate text-base font-black">{s.title}</span>
            </div>
            <span className={`nb-border mb-3 inline-block self-start px-2.5 py-1 text-xs font-bold uppercase ${
              s.state === "running" ? "bg-[#2ECC71] text-black" :
              s.state === "paused" ? "bg-[#FFD400] text-black" :
              s.state === "awaiting_input" ? "bg-[#FF9440] text-black" :
              "bg-muted text-muted-foreground"
            }`}>
              {s.state.replace(/_/g, " ")}
            </span>
            <p className="mb-4 text-sm text-muted-foreground">{s.activity}</p>
            <div className="mt-auto flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {Array.from({ length: Math.min(s.humans, 3) }).map((_, i) => (
                  <span
                    key={i}
                    className="nb-border inline-block size-7 rounded-full bg-[#4DA6FF] text-center text-[11px] font-bold leading-7 text-black"
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{s.humans} online</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type SessionPhase = "chat" | "memory" | "interrupt";

function SessionScreen({ phase }: { phase: SessionPhase }) {
  const visibleMessages =
    phase === "chat" ? MOCK_CHAT.slice(0, 5) :
    phase === "memory" ? MOCK_CHAT.slice(0, 6) :
    MOCK_CHAT.slice(0, 8);

  return (
    <div className="flex h-full w-full bg-background">
      <div className="hidden w-64 shrink-0 border-r-2 border-foreground/20 bg-card p-5 md:block">
        <p className="mb-4 text-sm font-black uppercase tracking-wider text-muted-foreground">Participants</p>
        <div className="space-y-2">
          [
            { name: "Sarah Chen", role: "driver", color: "#FF5C5C" },
            { name: "Marcus Webb", role: "co-pilot", color: "#4DA6FF" },
            { name: "Claude", role: "ai agent", color: "#2ECC71" },
          ].map((p) => (
            <div key={p.name} className="nb-border flex items-center gap-2.5 bg-background px-4 py-2.5">
              <span className="inline-block size-3 rounded-full" style={{ background: p.color }} />
              <span className="text-sm font-bold">{p.name}</span>
              <span className="ml-auto text-xs text-muted-foreground uppercase">{p.role}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 nb-border bg-background p-4">
          <p className="text-xs font-black uppercase text-muted-foreground">Agent Status</p>
          <p className="mt-2 text-sm text-[#2ECC71]">● Active — responding to Marcus</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="nb-border flex items-center gap-3 border-x-0 border-t-0 bg-card px-6 py-4">
          <span className="nb-border bg-[#4DA6FF] px-2.5 py-1 text-xs font-black text-black">CHAT</span>
          <span className="text-base font-black">Acme Corp Refund Escalation</span>
          <span className="nb-border ml-auto bg-[#2ECC71] px-2.5 py-1 text-xs font-bold text-black">RUNNING</span>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-6">
          {visibleMessages.map((m, i) => {
            if (m.type === "human") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[70%] nb-border bg-card p-4">
                    <p className="mb-1 text-sm font-black" style={{ color: m.color }}>{m.name}</p>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>
                </div>
              );
            }
            if (m.type === "agent") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[70%] nb-border bg-[#2ECC71]/10 p-4">
                    <p className="mb-1 text-sm font-black text-[#2ECC71]">Claude</p>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">prompted by @{m.promptedBy}</p>
                  </div>
                </div>
              );
            }
            if (m.type === "thought") {
              return (
                <div key={i} className="flex justify-center">
                  <div className="nb-border bg-[#FFD400]/15 px-5 py-2.5 text-center text-sm italic text-muted-foreground">
                    <Sparkles className="mr-2 inline size-5 text-[#FFD400]" />
                    {m.text}
                  </div>
                </div>
              );
            }
            if (m.type === "tool") {
              return (
                <div key={i} className="flex justify-center">
                  <div className="nb-border max-w-[80%] bg-muted p-4">
                    <p className="mb-1 text-sm font-black text-[#FF9440]">⚙ {m.tool}</p>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{m.args}</pre>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-[#2ECC71]">{m.result}</pre>
                  </div>
                </div>
              );
            }
            if (m.type === "memory") {
              return (
                <div key={i} className="flex justify-center">
                  <div className="nb-border max-w-[70%] border-[#B57BFF] bg-[#B57BFF]/10 p-4">
                    <p className="mb-1 text-sm font-black text-[#B57BFF]">
                      <Bot className="mr-2 inline size-5" />
                      Team Memory
                    </p>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <a className="mt-2 inline-block text-sm font-bold text-[#B57BFF] underline">
                      from {m.citedFrom} →
                    </a>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
        <div className="nb-border border-x-0 border-b-0 bg-card px-6 py-4">
          <div className="nb-border flex bg-background px-5 py-3.5 text-sm text-muted-foreground">
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
    <div className="flex h-full w-full flex-col bg-background p-8">
      <div className="mb-5 flex items-center gap-3">
        <Shield className="size-6 text-[#FF9440]" />
        <h2 className="text-2xl font-black uppercase tracking-tight">Approval Gate</h2>
      </div>
      <p className="mb-5 text-base text-muted-foreground">Agent proposed a code change — review the diff before it goes live</p>
      <div className="nb-border mb-5 bg-card p-5">
        <p className="text-base font-black">{MOCK_GATE.title}</p>
        <span className={`nb-border mt-2.5 inline-block bg-[#FF9440] px-2.5 py-1 text-sm font-bold text-black uppercase ${approved ? "bg-[#2ECC71]" : ""}`}>
          {approved ? "Approved ✓" : "Pending Review"}
        </span>
      </div>
      <div className="nb-border flex-1 overflow-auto bg-card">
        <div className="grid h-full grid-cols-2 divide-x-2 divide-foreground/20">
          <div className="p-5">
            <p className="mb-4 text-sm font-black uppercase text-muted-foreground">Before</p>
            <pre className="text-sm leading-6">
              {beforeLines.map((line, i) => (
                <div key={i} className="bg-[#FF5C5C]/8 px-2 text-[#FF5C5C]/70">
                  <span className="inline-block w-6 text-right text-muted-foreground/50">{i + 1}</span> {line}
                </div>
              ))}
            </pre>
          </div>
          <div className="p-5">
            <p className="mb-4 text-sm font-black uppercase text-muted-foreground">After</p>
            <pre className="text-sm leading-6">
              {afterLines.map((line, i) => (
                <div key={i} className="bg-[#2ECC71]/8 px-2 text-[#2ECC71]/80">
                  <span className="inline-block w-6 text-right text-muted-foreground/50">{i + 1}</span> {line}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
      {!approved && (
        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={() => setApproved(true)}
            className="nb-border nb-lift h-11 bg-[#2ECC71] px-5 text-base font-black text-black"
          >
            ✓ Approve
          </Button>
          <Button className="nb-border h-11 bg-card px-5 text-base font-bold">
            ✏ Edit & Approve
          </Button>
          <Button className="nb-border h-11 bg-[#FF5C5C] px-5 text-base font-bold text-black">
            ✕ Reject
          </Button>
          <span className="ml-auto text-sm text-muted-foreground">
            <span className="inline-block size-2.5 rounded-full bg-[#2ECC71] mr-2" />
            Sarah Chen is reviewing
          </span>
        </div>
      )}
    </div>
  );
}

function TimeTravelScreen() {
  const [scrubPos, setScrubPos] = useState(100);
  const [forked, setForked] = useState(false);

  useEffect(() => {
    if (forked) return;
    let frame: number;
    let start = performance.now();
    const duration = 3000;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setScrubPos(100 - ease * 65);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setTimeout(() => setForked(true), 800);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [forked]);

  const visibleCount = Math.floor((scrubPos / 100) * MOCK_TIMELINE.length);

  return (
    <div className="flex h-full w-full flex-col bg-background p-8">
      <div className="mb-5 flex items-center gap-3">
        <GitFork className="size-6 text-[#FF5C5C]" />
        <h2 className="text-2xl font-black uppercase tracking-tight">Time Travel</h2>
        {forked && (
          <span className="nb-border ml-2 bg-[#B57BFF] px-3 py-1 text-sm font-black text-black">
            NEW FORK CREATED
          </span>
        )}
      </div>

      {forked ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="nb-border mb-6 bg-[#B57BFF]/10 p-8 text-center">
            <GitFork className="mx-auto mb-3 size-14 text-[#B57BFF]" />
            <p className="text-xl font-black">Forked from Acme Corp Refund Escalation</p>
            <p className="mt-2 text-sm text-muted-foreground">
              at event 5 of 8 — new session ready for a fresh agent run
            </p>
          </div>
          <div className="nb-border flex gap-3">
            <span className="nb-border bg-[#FF5C5C] px-4 py-2 text-sm font-bold text-black">FORK</span>
            <span className="text-base text-muted-foreground">→</span>
            <span className="nb-border bg-[#4DA6FF] px-4 py-2 text-sm font-bold text-black">INDEPENDENT SESSION</span>
          </div>
        </div>
      ) : (
        <>
          <div className="nb-border mb-5 flex-1 overflow-auto bg-card p-5">
            <div className="space-y-2">
              {MOCK_TIMELINE.map((ev) => {
                const visible = ev.seq <= visibleCount;
                return (
                  <div
                    key={ev.seq}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-opacity duration-300 ${
                      visible ? "opacity-100" : "opacity-20"
                    }`}
                  >
                    <span
                      className="nb-border inline-block size-2.5 shrink-0"
                      style={{
                        background:
                          ev.type === "agent" ? "#2ECC71" :
                          ev.type === "human" ? "#4DA6FF" :
                          ev.type === "proposal" ? "#FF9440" : "#999",
                      }}
                    />
                    <span className="font-bold">#{ev.seq}</span>
                    <span className="text-muted-foreground">{ev.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="nb-border bg-card p-5">
            <div className="mb-3 flex items-center gap-3 text-sm font-black">
              <span className="text-[#FF5C5C]">TIME TRAVEL</span>
              <span className="text-muted-foreground">— position {Math.round(scrubPos)}%</span>
            </div>
            <div className="relative h-5 w-full bg-muted">
              <div className="absolute inset-y-0 left-0 bg-[#FF5C5C]" style={{ width: `${scrubPos}%` }} />
              <div className="nb-border absolute top-1/2 size-6 -translate-y-1/2 bg-[#FFD400]" style={{ left: `calc(${scrubPos}% - 12px)` }} />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Event {visibleCount} / {MOCK_TIMELINE.length}
              </span>
              <span className="nb-border bg-[#FF5C5C] px-2.5 py-1 text-sm font-bold text-black">
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
    <div className="flex h-full w-full flex-col bg-background p-8">
      <div className="mb-5 flex items-center gap-3">
        <Clock className="size-6 text-[#00C2C7]" />
        <h2 className="text-2xl font-black uppercase tracking-tight">Handoff & Away Briefing</h2>
      </div>
      <div className="nb-border mb-5 bg-card p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="nb-border bg-[#00C2C7] px-3 py-1 text-sm font-black text-black">HANDED OFF</span>
          <span className="text-sm text-muted-foreground">2 hours ago by Sarah Chen → Marcus Webb</span>
        </div>
        <p className="text-sm text-muted-foreground">
          "Picking up where I left off — we calculated the $120 prorated refund for Acme's add-on bundle. Approval gate is pending. Customer prefers email."
        </p>
      </div>
      <div className="nb-border bg-[#FFD400]/10 p-6">
        <p className="mb-4 text-base font-black text-[#FFD400]">📧 While you were away</p>
        <div className="space-y-2.5">
          [
            { dot: "#2ECC71", text: 'Agent completed KB search for "partial refund add-on bundle policy"' },
            { dot: "#2ECC71", text: 'Agent saved team memory: "Acme Corp refund = $120 prorated add-on bundle"' },
            { dot: "#FF9440", text: "1 approval gate pending your review", bold: true },
            { dot: "#4DA6FF", text: "Marcus Webb joined as co-pilot (handoff from Sarah Chen)" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 inline-block size-2.5 shrink-0" style={{ background: item.dot }} />
              <span className={item.bold ? "font-bold" : ""}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinishScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background p-10">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-black uppercase tracking-tight">Your Team + AI, Live</h2>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          Multiplayer sessions that run continuously across handoffs, with live presence,
          time travel, approval gates, and shared memory.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-5">
        [
          { label: "Live Sessions", value: "6", color: "#2ECC71" },
          { label: "Team Members", value: "4", color: "#4DA6FF" },
          { label: "Memories Saved", value: "12", color: "#B57BFF" },
        ].map((s) => (
          <div key={s.label} className="nb-border bg-card p-8 text-center">
            <p className="text-4xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="mt-2 text-sm font-bold uppercase text-muted-foreground">{s.label}</p>
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep = STEPS[stepIdx];

  useEffect(() => {
    if (!active || paused || !currentStep) return;
    timerRef.current = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
      else {
        setActive(false);
        setStepIdx(0);
      }
    }, currentStep.durationMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
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
    else { setActive(false); setStepIdx(0); }
  }, [stepIdx]);

  const endDemo = useCallback(() => {
    setActive(false);
    setStepIdx(0);
    setPaused(false);
  }, []);

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

  if (!active) {
    return (
      <Button
        onClick={startDemo}
        className="nb-border nb-lift h-15 bg-[#2ECC71] px-10 text-lg font-black text-black"
      >
        <Play className="mr-2 size-5" />
        Start guided demo
      </Button>
    );
  }

  return (
    <>
      <Cursor active={active} stepId={currentStep?.id ?? ""} />

      <div className="fixed inset-0 z-[10000] flex flex-col bg-background">
        {/* Top bar */}
        <div className="nb-border flex items-center gap-4 border-x-0 border-t-0 bg-card px-6 py-3.5 sm:px-8 sm:py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => skipToStep(i)}
                className="nb-border size-4.5 transition-all hover:ring-2 hover:ring-foreground/20"
                style={{
                  background: i <= stepIdx ? s.color : "transparent",
                  transform: i === stepIdx ? "scale(1.4)" : "scale(1)",
                }}
                title={s.title}
              />
            ))}
          </div>

          {currentStep && (
            <div className="flex items-center gap-3">
              <currentStep.icon className="size-5 shrink-0" style={{ color: currentStep.color }} />
              <div>
                <p className="text-sm font-black uppercase">{currentStep.title}</p>
                <p className="text-xs text-muted-foreground">{currentStep.subtitle}</p>
              </div>
            </div>
          )}

          <div className="ml-auto flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => setPaused(!paused)}
              className="nb-border h-10 bg-secondary px-4 text-sm font-bold"
            >
              {paused ? <><Play className="size-4" /> Resume</> : <><Square className="size-4" /> Pause</>}
            </Button>
            <Button
              size="sm"
              onClick={nextStep}
              className="nb-border h-10 bg-primary px-4 text-sm font-black"
            >
              <SkipForward className="size-4" /> Next
            </Button>
            <Button
              size="sm"
              onClick={endDemo}
              variant="outline"
              className="nb-border h-10 bg-card px-4 text-sm font-bold"
            >
              ✕ End
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">{renderScreen()}</div>
      </div>
    </>
  );
}

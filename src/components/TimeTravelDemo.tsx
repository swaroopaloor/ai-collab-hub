import { Bot, GitBranch, GitFork, History, Radio, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STEPS = ["live", "scrubbing", "forked", "compare"] as const;
type Step = (typeof STEPS)[number];

const STEP_DURATION_MS = 3500;

const MOCK_EVENTS = [
  { id: "e1", type: "human", name: "Maya", text: "Hey @claude, why did signups dip this week?" },
  { id: "e2", type: "agent", text: "Pulling the signup funnel data now..." },
  { id: "e3", type: "tool", text: "search_knowledge_base(\"signup funnel\")" },
  { id: "e4", type: "agent", text: "Found the issue — the /signup CTA was broken on mobile after Thursday's deploy. Traffic dropped 34% on iOS." },
  { id: "e5", type: "human", name: "Jonas", text: "Nice catch. Can you suggest a fix?" },
  { id: "e6", type: "agent", text: "The form component's media query is missing a breakpoint. Here's the diff..." },
  { id: "e7", type: "human", name: "Maya", text: "What if we redirect the agent to investigate the billing flow instead?" },
];

function ChatBubble({ ev }: { ev: typeof MOCK_EVENTS[0] }) {
  if (ev.type === "tool") {
    return (
      <div className="flex justify-center">
        <div className="nb-border flex items-center gap-2 bg-secondary px-3 py-1.5 font-mono text-xs">
          <Wrench className="size-4" />
          {ev.text}
        </div>
      </div>
    );
  }
  if (ev.type === "agent") {
    return (
      <div className="max-w-[80%] self-end">
        <p className="mb-1 text-right text-xs font-black tracking-wide text-muted-foreground">
          <span className="bg-primary px-1.5 py-0.5 text-black">AGENT</span>
        </p>
        <div className="nb-border nb-shadow-sm w-fit bg-primary/90 px-3 py-2 text-left text-sm leading-relaxed">
          {ev.text}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[75%] self-start">
      <p className="mb-1 text-xs font-black uppercase text-muted-foreground">{ev.name}</p>
      <div className="nb-border nb-shadow-sm w-fit bg-background px-3 py-2 text-sm leading-relaxed">
        {ev.text}
      </div>
    </div>
  );
}

function LiveStep() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="nb-border flex h-9 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-secondary px-4">
        <span className="size-2 bg-[#FF5C5C]" />
        <span className="size-2 bg-[#FFD400]" />
        <span className="size-2 bg-[#2ECC71]" />
        <span className="ml-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
          Launch War Room · running
        </span>
        <span className="nb-border ml-auto hidden items-center gap-1.5 bg-[#D9F99D] px-2 py-1 text-xs font-bold sm:inline-flex">
          <Bot className="size-3 animate-pulse" />
          thinking...
        </span>
      </div>
      <div className="flex flex-1 flex-col items-stretch gap-3 overflow-hidden px-4 py-4">
        {MOCK_EVENTS.map((ev) => (
          <ChatBubble key={ev.id} ev={ev} />
        ))}
        <p className="self-center text-center text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
          awaiting response...
        </p>
      </div>
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-4 py-2">
        <div className="nb-border flex size-6 shrink-0 items-center justify-center bg-secondary">
          <Radio className="size-3" />
        </div>
        <div className="h-2 flex-1 bg-secondary">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: "100%" }} />
        </div>
        <span className="text-xs font-black uppercase text-muted-foreground">
          LIVE · {MOCK_EVENTS.length} events
        </span>
      </div>
    </div>
  );
}

function ScrubStep() {
  const [scrubTo, setScrubTo] = useState(MOCK_EVENTS.length);

  useEffect(() => {
    let frame: number;
    let start = performance.now();
    const duration = 2500;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setScrubTo(Math.max(1, MOCK_EVENTS.length - Math.round(ease * (MOCK_EVENTS.length - 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const visibleCount = scrubTo;
  const scrubberPercent = (scrubTo / MOCK_EVENTS.length) * 100;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="nb-border flex h-9 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-secondary px-4">
        <span className="size-2 bg-[#FF5C5C]" />
        <span className="size-2 bg-[#FFD400]" />
        <span className="size-2 bg-[#2ECC71]" />
        <span className="ml-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
          Launch War Room · paused
        </span>
        <span className="nb-border ml-auto hidden items-center gap-1.5 bg-[#4DA6FF] px-2 py-1 text-xs font-bold text-black sm:inline-flex">
          <History className="size-3" />
          TIME TRAVEL
        </span>
      </div>
      <div className="flex flex-1 flex-col items-stretch gap-3 overflow-hidden px-4 py-4">
        {MOCK_EVENTS.map((ev, i) => (
          <div key={ev.id} className={`transition-all duration-300 ${i >= visibleCount ? "opacity-20" : "opacity-100"}`}>
            <ChatBubble ev={ev} />
          </div>
        ))}
      </div>
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-4 py-2">
        <div className="nb-border flex size-6 shrink-0 items-center justify-center bg-secondary">
          <History className="size-3" />
        </div>
        <div className="h-2 flex-1 bg-secondary">
          <div className="h-full bg-[#4DA6FF] transition-all duration-1000 ease-in-out" style={{ width: `${scrubberPercent}%` }} />
        </div>
        <span className="text-xs font-black uppercase" style={{ color: "#4DA6FF" }}>
          POS {scrubTo}/{MOCK_EVENTS.length}
        </span>
        <span className="nb-border hidden bg-[#B57BFF] px-2 py-1 text-xs font-bold text-black sm:inline">
          ⑂ Fork from here
        </span>
      </div>
    </div>
  );
}

function ForkStep() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="nb-border flex h-9 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-secondary px-4">
        <span className="size-2 bg-[#FF5C5C]" />
        <span className="size-2 bg-[#FFD400]" />
        <span className="ml-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
          Launch War Room (fork) · running
        </span>
      </div>
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-t-0 bg-accent px-4 py-2">
        <GitFork className="size-4 shrink-0" />
        <span className="text-xs font-semibold">
          Forked from{" "}
          <span className="underline decoration-2">Launch War Room</span>{" "}
          at position 4 · fresh agent run
        </span>
      </div>
      <div className="flex flex-1 flex-col items-stretch gap-3 overflow-hidden px-4 py-4">
        {MOCK_EVENTS.slice(0, 4).map((ev) => (
          <ChatBubble key={ev.id} ev={ev} />
        ))}
        <div className="max-w-[80%] self-end">
          <p className="mb-1 text-right text-xs font-black tracking-wide text-muted-foreground">
            <span className="bg-primary px-1.5 py-0.5 text-black">AGENT</span>
          </p>
          <div className="nb-border nb-shadow-sm w-fit bg-primary/90 px-3 py-2 text-left text-sm leading-relaxed">
            Starting fresh from the fork — I'll investigate the billing flow as requested by @Maya.
          </div>
        </div>
      </div>
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-4 py-2">
        <div className="nb-border flex size-6 shrink-0 items-center justify-center bg-primary">
          <Radio className="size-3 text-black" />
        </div>
        <div className="h-2 flex-1 bg-secondary">
          <div className="h-full bg-primary" style={{ width: "75%" }} />
        </div>
        <span className="text-xs font-black uppercase text-muted-foreground">
          5 events · fresh run
        </span>
      </div>
    </div>
  );
}

function CompareStep() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="nb-border flex h-9 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-card px-4">
        <GitBranch className="size-4" />
        <span className="text-xs font-black uppercase tracking-tight">
          Compare sessions
        </span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col border-r-2 border-foreground">
          <div className="nb-border flex shrink-0 items-center gap-1 border-l-0 border-r-0 border-t-0 bg-secondary px-3 py-1.5">
            <span className="text-xs font-black uppercase tracking-widest bg-card px-1.5">Original</span>
            <span className="text-xs font-bold underline">Launch War Room</span>
          </div>
          <div className="flex flex-1 flex-col items-stretch gap-3 overflow-hidden px-3 py-3">
            {MOCK_EVENTS.slice(0, 5).map((ev) => (
              <ChatBubble key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="nb-border flex shrink-0 items-center gap-1 border-l-0 border-r-0 border-t-0 bg-secondary px-3 py-1.5">
            <span className="nb-border text-xs font-black uppercase tracking-widest bg-[#B57BFF] px-1.5 text-black">Fork</span>
            <span className="text-xs font-bold underline">Launch War Room (fork)</span>
          </div>
          <div className="flex flex-1 flex-col items-stretch gap-3 overflow-hidden px-3 py-3">
            {MOCK_EVENTS.slice(0, 3).map((ev) => (
              <ChatBubble key={ev.id} ev={ev} />
            ))}
            <div className="max-w-[85%] self-end">
              <div className="nb-border nb-shadow-sm w-fit bg-primary/90 px-3 py-2 text-sm text-left">
                Investigating billing flow now...
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-accent px-4 py-2">
        <GitBranch className="size-3" />
        <div className="h-2 flex-1 bg-secondary">
          <div className="h-full bg-[#B57BFF]" style={{ width: "65%" }} />
        </div>
        <span className="text-xs font-black uppercase text-muted-foreground">POS 65%</span>
        <span className="text-xs font-black uppercase" style={{ color: "#4DA6FF" }}>synced</span>
      </div>
    </div>
  );
}

export default function TimeTravelDemo() {
  const [step, setStep] = useState<Step>("live");
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % STEPS.length);
    }, STEP_DURATION_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setStep(STEPS[stepIndex]);
  }, [stepIndex]);

  return (
    <div className="nb-border nb-shadow overflow-hidden bg-card">
      <div className="nb-border flex items-center gap-2 border-x-0 border-t-0 bg-secondary px-4 py-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStepIndex(i)}
            className={`nb-border size-2.5 transition-colors ${
              STEPS[stepIndex] === s
                ? "bg-primary"
                : "bg-card hover:bg-secondary"
            }`}
            aria-label={`Go to step: ${s}`}
          />
        ))}
        <span className="ml-auto text-xs font-black uppercase tracking-widest text-muted-foreground">
          {step === "live"
            ? "① Live session"
            : step === "scrubbing"
              ? "② Scrub back in time"
              : step === "forked"
                ? "③ Fork from any point"
                : "④ Compare side-by-side"}
        </span>
      </div>
      <div className="relative h-72 overflow-hidden sm:h-80">
        {step === "live" && <LiveStep />}
        {step === "scrubbing" && <ScrubStep />}
        {step === "forked" && <ForkStep />}
        {step === "compare" && <CompareStep />}
      </div>
    </div>
  );
}

import { Bot, GitBranch, GitFork, History, Radio, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STEPS = [
  "live",
  "scrubbing",
  "forked",
  "compare",
] as const;
type Step = (typeof STEPS)[number];

const STEP_DURATION_MS = 3200;

const MOCK_EVENTS = [
  { id: "e1", type: "human", name: "Maya", text: "Hey @claude, why did signups dip this week?" },
  { id: "e2", type: "agent", text: "Pulling the signup funnel data now..." },
  { id: "e3", type: "tool", text: "search_knowledge_base(\"signup funnel\")" },
  { id: "e4", type: "agent", text: "Found the issue — the /signup CTA was broken on mobile after Thursday's deploy. Traffic dropped 34% on iOS." },
  { id: "e5", type: "human", name: "Jonas", text: "Nice catch. Can you suggest a fix?" },
  { id: "e6", type: "agent", text: "The form component's media query is missing a breakpoint. Here's the diff..." },
  { id: "e7", type: "human", name: "Maya", text: "What if we redirect the agent to investigate the billing flow instead?" },
];

function ChatBubble({ ev, hidden }: { ev: typeof MOCK_EVENTS[0]; hidden?: boolean }) {
  if (ev.type === "tool") {
    return (
      <div className={`flex justify-center transition-all duration-500 ${hidden ? "scale-90 opacity-0" : "opacity-100"}`}>
        <div className="nb-border flex items-center gap-1.5 bg-secondary px-2.5 py-1 font-mono text-[10px]">
          <Wrench className="size-3" />
          {ev.text}
        </div>
      </div>
    );
  }
  if (ev.type === "agent") {
    return (
      <div className={`max-w-[80%] self-end transition-all duration-500 ${hidden ? "scale-90 opacity-0" : "opacity-100"}`}>
        <p className="mb-0.5 text-right text-[8px] font-black tracking-wide text-muted-foreground">
          <span className="bg-primary px-1 py-px text-[8px] text-black">AGENT</span>
        </p>
        <div className="nb-border nb-shadow-sm w-fit bg-primary/90 px-2.5 py-1.5 text-left text-xs leading-relaxed">
          {ev.text}
        </div>
      </div>
    );
  }
  return (
    <div className={`max-w-[75%] self-start transition-all duration-500 ${hidden ? "scale-90 opacity-0" : "opacity-100"}`}>
      <p className="mb-0.5 text-[8px] font-black uppercase text-muted-foreground">{ev.name}</p>
      <div className="nb-border nb-shadow-sm w-fit bg-background px-2.5 py-1.5 text-xs leading-relaxed">
        {ev.text}
      </div>
    </div>
  );
}

function LiveStep({ visibleCount }: { visibleCount: number }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Session header */}
      <div className="nb-border flex h-8 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-secondary px-3">
        <span className="size-1.5 bg-[#FF5C5C]" />
        <span className="size-1.5 bg-[#FFD400]" />
        <span className="size-1.5 bg-[#2ECC71]" />
        <span className="ml-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          Launch War Room · running
        </span>
        <span className="nb-border ml-auto hidden items-center gap-1 bg-[#D9F99D] px-1.5 py-0.5 text-[8px] font-bold sm:inline-flex">
          <Bot className="size-2.5 animate-pulse" />
          thinking...
        </span>
      </div>
      {/* Messages */}
      <div className="flex flex-1 flex-col items-stretch gap-2.5 overflow-hidden px-3 py-3">
        {MOCK_EVENTS.slice(0, visibleCount).map((ev) => (
          <ChatBubble key={ev.id} ev={ev} />
        ))}
        {visibleCount >= MOCK_EVENTS.length && (
          <p className="self-center text-center text-[8px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
            awaiting response...
          </p>
        )}
      </div>
      {/* Scrubber — live */}
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-3 py-1.5">
        <div className="nb-border flex size-5 shrink-0 items-center justify-center bg-secondary">
          <Radio className="size-2.5" />
        </div>
        <div className="h-1.5 flex-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: "100%" }}
          />
        </div>
        <span className="text-[8px] font-black uppercase text-muted-foreground">
          LIVE · {visibleCount} events
        </span>
      </div>
    </div>
  );
}

function ScrubStep({ scrubTo }: { scrubTo: number }) {
  const visibleCount = scrubTo;
  const scrubberPercent = (scrubTo / MOCK_EVENTS.length) * 100;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="nb-border flex h-8 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-secondary px-3">
        <span className="size-1.5 bg-[#FF5C5C]" />
        <span className="size-1.5 bg-[#FFD400]" />
        <span className="size-1.5 bg-[#2ECC71]" />
        <span className="ml-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          Launch War Room · paused
        </span>
        <span className="nb-border ml-auto hidden items-center gap-1 bg-[#4DA6FF] px-1.5 py-0.5 text-[8px] font-bold text-black sm:inline-flex">
          <History className="size-2.5" />
          TIME TRAVEL
        </span>
      </div>
      <div className="flex flex-1 flex-col items-stretch gap-2.5 overflow-hidden px-3 py-3">
        {MOCK_EVENTS.map((ev, i) => (
          <ChatBubble key={ev.id} ev={ev} hidden={i >= visibleCount} />
        ))}
      </div>
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-3 py-1.5">
        <div className="nb-border flex size-5 shrink-0 items-center justify-center bg-secondary">
          <History className="size-2.5" />
        </div>
        <div className="h-1.5 flex-1 bg-secondary">
          <div
            className="h-full bg-[#4DA6FF] transition-all duration-1000 ease-in-out"
            style={{ width: `${scrubberPercent}%` }}
          />
        </div>
        <span className="text-[8px] font-black uppercase text-[#4DA6FF]">
          POS {scrubTo}/{MOCK_EVENTS.length}
        </span>
        <span className="nb-border hidden bg-[#B57BFF] px-1.5 py-0.5 text-[8px] font-bold text-black sm:inline">
          ⑂ Fork from here
        </span>
      </div>
    </div>
  );
}

function ForkStep() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="nb-border flex h-8 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-secondary px-3">
        <span className="size-1.5 bg-[#FF5C5C]" />
        <span className="size-1.5 bg-[#FFD400]" />
        <span className="ml-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          Launch War Room (fork) · running
        </span>
      </div>
      {/* Fork lineage banner */}
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-t-0 bg-accent px-3 py-1.5">
        <GitFork className="size-3 shrink-0" />
        <span className="text-[9px] font-semibold">
          Forked from{" "}
          <span className="underline decoration-2">Launch War Room</span>{" "}
          at position 4 · fresh agent run
        </span>
      </div>
      <div className="flex flex-1 flex-col items-stretch gap-2.5 overflow-hidden px-3 py-3">
        {MOCK_EVENTS.slice(0, 4).map((ev) => (
          <ChatBubble key={ev.id} ev={ev} />
        ))}
        {/* New agent message in the fork */}
        <div className="max-w-[80%] self-end">
          <p className="mb-0.5 text-right text-[8px] font-black tracking-wide text-muted-foreground">
            <span className="bg-primary px-1 py-px text-[8px] text-black">AGENT</span>
          </p>
          <div className="nb-border nb-shadow-sm w-fit bg-primary/90 px-2.5 py-1.5 text-left text-xs leading-relaxed">
            Starting fresh from the fork — I'll investigate the billing flow as requested by @Maya.
          </div>
        </div>
      </div>
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-3 py-1.5">
        <div className="nb-border flex size-5 shrink-0 items-center justify-center bg-primary">
          <Radio className="size-2.5 text-black" />
        </div>
        <div className="h-1.5 flex-1 bg-secondary">
          <div className="h-full bg-primary" style={{ width: "80%" }} />
        </div>
        <span className="text-[8px] font-black uppercase text-muted-foreground">
          5 events · fresh run
        </span>
      </div>
    </div>
  );
}

function CompareStep() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="nb-border flex h-8 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-card px-3">
        <GitBranch className="size-3" />
        <span className="text-[9px] font-black uppercase tracking-tight">
          Compare sessions
        </span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — Original */}
        <div className="flex min-w-0 flex-1 flex-col border-r-2 border-foreground">
          <div className="nb-border flex shrink-0 items-center gap-1 border-l-0 border-r-0 border-t-0 bg-secondary px-2 py-1">
            <span className="text-[8px] font-black uppercase tracking-widest bg-card px-1">Original</span>
            <span className="text-[8px] font-bold underline">Launch War Room</span>
          </div>
          <div className="flex flex-1 flex-col items-stretch gap-2 overflow-hidden px-2 py-2">
            {MOCK_EVENTS.slice(0, 5).map((ev) => (
              <ChatBubble key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
        {/* Right pane — Fork */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="nb-border flex shrink-0 items-center gap-1 border-l-0 border-r-0 border-t-0 bg-secondary px-2 py-1">
            <span className="text-[8px] font-black uppercase tracking-widest bg-[#B57BFF] px-1 text-black">Fork</span>
            <span className="text-[8px] font-bold underline">Launch War Room (fork)</span>
          </div>
          <div className="flex flex-1 flex-col items-stretch gap-2 overflow-hidden px-2 py-2">
            {MOCK_EVENTS.slice(0, 3).map((ev) => (
              <ChatBubble key={ev.id} ev={ev} />
            ))}
            <div className="max-w-[85%] self-end">
              <div className="nb-border nb-shadow-sm w-fit bg-primary/90 px-2 py-1 text-[10px] text-left">
                Investigating billing flow now...
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Synced scrubber */}
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-accent px-3 py-1.5">
        <GitBranch className="size-2.5" />
        <div className="h-1.5 flex-1 bg-secondary">
          <div className="h-full bg-[#B57BFF]" style={{ width: "65%" }} />
        </div>
        <span className="text-[8px] font-black uppercase text-muted-foreground">POS 65%</span>
        <span className="text-[8px] font-black uppercase text-[#4DA6FF]">synced</span>
      </div>
    </div>
  );
}

export default function TimeTravelDemo() {
  const [step, setStep] = useState<Step>("live");
  const [stepIndex, setStepIndex] = useState(0);
  const [scrubTarget, setScrubTarget] = useState(MOCK_EVENTS.length);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        const next = (prev + 1) % STEPS.length;
        return next;
      });
    }, STEP_DURATION_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setStep(STEPS[stepIndex]);
    if (STEPS[stepIndex] === "scrubbing") {
      setScrubTarget(3);
    }
  }, [stepIndex]);

  const visibleCount = useMemo(() => {
    if (step === "live") return MOCK_EVENTS.length;
    if (step === "scrubbing") return scrubTarget;
    if (step === "forked") return 4;
    return 5;
  }, [step, scrubTarget]);

  return (
    <div className="nb-border nb-shadow overflow-hidden bg-card">
      {/* Step indicator dots */}
      <div className="nb-border flex items-center gap-2 border-x-0 border-t-0 bg-secondary px-3 py-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => {
              setStepIndex(i);
            }}
            className={`nb-border size-2 transition-colors ${
              STEPS[stepIndex] === s
                ? "bg-primary"
                : "bg-card hover:bg-secondary"
            }`}
            aria-label={`Go to step: ${s}`}
          />
        ))}
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          {step === "live"
            ? "① Live session"
            : step === "scrubbing"
              ? "② Scrub back in time"
              : step === "forked"
                ? "③ Fork from any point"
                : "④ Compare side-by-side"}
        </span>
      </div>

      {/* Demo content */}
      <div className="relative h-64 overflow-hidden sm:h-72">
        {step === "live" && <LiveStep visibleCount={visibleCount} />}
        {step === "scrubbing" && <ScrubStep scrubTo={scrubTarget} />}
        {step === "forked" && <ForkStep />}
        {step === "compare" && <CompareStep />}
      </div>
    </div>
  );
}

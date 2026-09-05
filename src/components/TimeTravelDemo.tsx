import { Bot, GitBranch, GitFork, History, Radio, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STEPS = ["live", "scrubbing", "forked", "compare"] as const;
type Step = (typeof STEPS)[number];

const STEP_DURATION_MS = 3500;

const MOCK_EVENTS = [
  { id: "e1", type: "human", name: "Maya", text: "Hey @claude, why did signups drop last week?" },
  { id: "e2", type: "agent", name: "Claude", text: "Let me check the funnel data.", tool: "query_funnels(start=last_7d)" },
  { id: "e3", type: "agent", name: "Claude", text: "Signups dropped 23% on Tuesday. Here's why:" },
  { id: "e4", type: "human", name: "Jonas", text: "Show me the top source by signups." },
  { id: "e5", type: "agent", name: "Claude", text: "Organic search is down 34% — looks like a recrawl issue." },
  { id: "e6", type: "human", name: "Maya", text: "Can you dig into the crawl error logs?" },
  { id: "e7", type: "agent", name: "Claude", text: "Pulling web crawl logs now.", tool: "query_crawl_errors(days=7)" },
];

const MOCK_FORK = [
  { id: "f1", type: "human", name: "Maya", text: "Hey @claude, why did signups drop last week?" },
  { id: "f2", type: "agent", name: "Claude", text: "Let me check the funnel data.", tool: "query_funnels(start=last_7d)" },
  { id: "f3", type: "agent", name: "Claude", text: "Signups dropped 23% on Tuesday.", tool: "query_traffic_sources()" },
];

const MOCK_COMPARE_LEFT = [
  { id: "cl1", type: "agent", name: "Claude", text: "Signups dropped 23% on Tuesday.", tool: null, replyTo: "e2" },
  { id: "cl2", type: "agent", name: "Claude", text: "Root cause: organic search down 34% (recrawl issue)." },
  { id: "cl3", type: "human", name: "Maya", text: "Thanks, let's fix the recrawl." },
];

const MOCK_COMPARE_RIGHT = [
  { id: "cr1", type: "agent", name: "Claude", text: "Signups dropped 23% on Tuesday.", tool: null, replyTo: "f2" },
  { id: "cr2", type: "agent", name: "Claude", text: "Root cause: paid ad spend was reduced Monday.", tool: "query_ad_spend(days=14)" },
  { id: "cr3", type: "human", name: "Maya", text: "Interesting — that's a totally different angle." },
];

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ["live", "scrubbing", "forked", "compare"];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s) => {
        const active = s === step;
        return (
          <button
            key={s}
            onClick={() => {}}
            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              active
                ? "bg-neutral-900 border border-neutral-900 shadow-[0_0_0_2px_#000000]"
                : "bg-neutral-300"
            }`}
            aria-label={`Step ${s}`}
          />
        );
      })}
      <span className="ml-2 text-sm font-medium uppercase tracking-widest text-neutral-700">
        {step === "live" && "Live Session"}
        {step === "scrubbing" && "Scrubbing Time"}
        {step === "forked" && "Forked Branch"}
        {step === "compare" && "Compare Side-by-Side"}
      </span>
    </div>
  );
}

function Scrubber({ position, dragging, label }: { position: number; dragging: boolean; label: string }) {
  return (
    <div className="mt-6 border-black border-2 rounded-sm bg-black p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase text-neutral-500">Timeline</span>
        <span className="text-xs font-bold">{label}</span>
      </div>
      <div className="relative h-3 bg-neutral-200 rounded-sm overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-amber-400 rounded-sm transition-all duration-1000 ease-in-out"
          style={{ width: `${position * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={position}
          onChange={(e) => {}}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Scrub timeline"
        />
        <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-1">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-400 rounded-full border-2 border-black shadow-[0_0_0_2px_#000000] transition-transform ease-out"
            style={{ left: `${position * 100}%`, transform: "translate(-50%, -50%)" }}
          />
        </div>
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-neutral-500 font-mono">
        <span>0:00</span>
        <span>2:30</span>
        <span>5:00</span>
      </div>
    </div>
  );
}

function PresenceBadges() {
  const colors = ["#FF5C5C", "#FFD500", "#4DA6FF", "#2ECC71"];
  return (
    <div className="flex items-center gap-1.5 mb-4">
      {[["Maya", colors[0]], ["Jonas", colors[1]], ["Claude", colors[2]]].map(([name, color]) => (
        <div
          key={name}
          className="relative h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-black text-white"
          style={{ backgroundColor: color }}
        >
          {name[0]}
          <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full bg-neutral-900 border-2 border-black flex items-center justify-center text-[6px]">
            <svg viewBox="0 0 10 10" className="w-full h-full" fill="currentColor">
              <circle cx="5" cy="5" r="3" />
            </svg>
          </span>
        </div>
      ))}
      <span className="ml-1 text-xs text-neutral-500">3 present</span>
    </div>
  );
}

function EventRow({ event }: { event: { id: string; type: string; name: string; text: string; tool?: string | null; replyTo?: string } }) {
  const isHuman = event.type === "human";
  const isAgent = event.type === "agent";
  return (
    <div
      className={`flex items-start gap-2 mb-2 ${
        isHuman ? "" : isAgent ? "flex justify-end" : ""
      }`}
    >
      {isAgent && <div className="flex-1 flex justify-end">
        <div className="max-w-[80%] bg-neutral-100 border-2 border-black rounded-sm p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase text-neutral-500">{event.name}</span>
            {event.tool && (
              <span className="text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded-sm font-mono">
                {event.tool}
              </span>
            )}
          </div>
          {event.text}
        </div>
      </div>}
      {isHuman && (
        <div className="flex-1 flex justify-start">
          <div className="max-w-[80%] bg-neutral-200 border-2 border-black rounded-sm p-3 text-sm">
            <div className="text-[11px] font-bold uppercase text-neutral-500 mb-1">{event.name}</div>
            {event.text}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    const d = setTimeout(() => setVisible(false), STEP_DURATION_MS - 200);
    return () => { clearTimeout(t); clearTimeout(d); };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <PresenceBadges />
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {MOCK_EVENTS.map((e, i) => (
          <div key={e.id} className={`transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2"}`} style={{ transitionDelay: `${i * 120}ms` }}>
            <EventRow event={e} />
          </div>
        ))}
      </div>
      <Scrubber position={1} dragging={false} label="Live" />
    </div>
  );
}

function ScrubbingScreen() {
  const [pos, setPos] = useState(0);
  const [visibleCount, setVisibleCount] = useState(7);

  useEffect(() => {
    const start = performance.now();
    const duration = STEP_DURATION_MS * 0.6;
    const anim = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const p = 3 / 7;
      setPos(p * (1 - eased) + eased * 1);
      setVisibleCount(Math.max(3, Math.round(7 * (1 - eased))));
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
    const end = setTimeout(() => setPos(1), STEP_DURATION_MS + 200);
    return () => clearTimeout(end);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b-2 border-black bg-neutral-100 px-3 py-1.5 flex items-center gap-2">
        <History className="size-4 text-neutral-700" />
        <span className="text-sm font-bold text-neutral-800">TIME TRAVEL</span>
        <span className="text-xs text-neutral-500 ml-1"> scrubbing to event 3 of 7</span>
      </div>
      <PresenceBadges />
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {MOCK_EVENTS.slice(0, visibleCount).map((e, i) => (
          <div key={e.id} className="transition-all duration-200" style={{ transitionDelay: `${i * 80}ms` }}>
            <EventRow event={e} />
          </div>
        ))}
        {visibleCount < 7 && (
          <div className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-neutral-300 rounded-sm">
            <div className="h-3 w-24 bg-neutral-100 rounded-sm animate-pulse" />
            <span className="text-sm text-neutral-400 italic">future events hidden</span>
          </div>
        )}
      </div>
      <Scrubber position={pos} dragging={true} label="Scrubbing" />
    </div>
  );
}

function ForkedScreen() {
  const [visible, setVisible] = useState(false);
  const [showLineage, setShowLineage] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowLineage(true), 400);
    const d = setTimeout(() => setVisible(true), 800);
    return () => { clearTimeout(t); clearTimeout(d); };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b-2 border-black bg-amber-100 px-3 py-1.5 flex items-center gap-2">
        <GitFork className="size-5 text-amber-700" />
        <span className="text-sm font-bold text-amber-900">FORKED BRANCH</span>
        <span className="text-xs text-amber-600 ml-1">fork created from "Launch War Room" at event 4</span>
      </div>
      <div className="border-2 border-amber-500 bg-amber-50 px-3 py-2 rounded-sm mb-3 flex items-center gap-2 text-sm text-amber-900">
        <GitBranch className="size-4" />
        <span>
          Forked from <strong>Launch War Room</strong> at position 4 — view original branch
        </span>
        <button className="ml-auto text-xs font-bold bg-amber-900 text-white px-2 py-1 rounded-sm border-2 border-black hover:bg-amber-800">
          View branch →
        </button>
      </div>
      <PresenceBadges />
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {MOCK_FORK.map((e) => (
          <div key={e.id} className="transition-all duration-300" style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)" }}>
            <EventRow event={e} />
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 text-white rounded-sm border-2 border-black mt-2">
          <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono">Claude is researching web crawl errors...</span>
        </div>
      </div>
      <Scrubber position={0.75} dragging={false} label="Forked Branch" />
    </div>
  );
}

function CompareScreen() {
  const [sharedPos, setSharedPos] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = STEP_DURATION_MS * 0.5;
    const anim = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      setSharedPos(eased * 0.65);
      if (t < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b-2 border-black bg-neutral-900 px-3 py-1.5 flex items-center gap-2 text-white">
        <GitFork className="size-5" />
        <span className="text-sm font-bold">Compare Branch</span>
        <span className="text-xs text-neutral-400 ml-auto">Original vs Fork — synced timeline</span>
      </div>
      <div className="flex-1 flex gap-2 min-h-0">
        <div className="flex-1 border-2 border-black rounded-sm bg-neutral-50 flex flex-col min-h-0">
          <div className="border-b-2 border-black px-3 py-1.5 bg-neutral-100 flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-neutral-600">Original</span>
            <span className="text-[10px] text-neutral-400">Session #142</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {MOCK_COMPARE_LEFT.map((e, i) => (
              <div key={e.id} className="transition-all duration-200" style={{ transitionDelay: `${i * 100}ms`, opacity: sharedPos >= (i+1)/4 ? 1 : 0.3 }}>
                <EventRow event={e} />
              </div>
            ))}
          </div>
          <Scrubber position={sharedPos} dragging={false} label="Synced" />
        </div>
        <div className="flex-1 border-2 border-black rounded-sm bg-neutral-50 flex flex-col min-h-0">
          <div className="border-b-2 border-black px-3 py-1.5 bg-amber-100 flex items-center gap-2">
            <GitFork className="size-3 text-amber-700" />
            <span className="text-xs font-bold uppercase text-amber-800">Fork</span>
            <span className="text-[10px] text-amber-600">Session #211</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {MOCK_COMPARE_RIGHT.map((e, i) => (
              <div key={e.id} className="transition-all duration-200" style={{ transitionDelay: `${i * 100 + 50}ms`, opacity: sharedPos >= (i+1)/4 ? 1 : 0.3 }}>
                <EventRow event={e} />
              </div>
            ))}
          </div>
          <Scrubber position={sharedPos} dragging={false} label="Synced" />
        </div>
      </div>
    </div>
  );
}

export default function TimeTravelDemo() {
  const [step, setStep] = useState<Step>("live");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => {
      const idx = STEPS.indexOf(step);
      setStep(STEPS[(idx + 1) % STEPS.length]);
    }, STEP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [step, paused]);

  const steps: Step[] = ["live", "scrubbing", "forked", "compare"];

  return (
    <div className="relative w-full h-full flex flex-col bg-neutral-100 border-2 border-black rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-neutral-50">
        <div>
          <span className="text-sm font-bold uppercase tracking-widest text-neutral-800">
            Time Travel Demo
          </span>
          <span className="ml-2 text-xs text-neutral-500">animated preview — click to pause</span>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-sm border-2 border-black hover:bg-neutral-800 transition-colors"
        >
          {paused ? (
            <>
              <Radio className="size-3" /> Play
            </>
          ) : (
            <>
              <Wrench className="size-3" /> Pause
            </>
          )}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {step === "live" && <LiveScreen />}
        {step === "scrubbing" && <ScrubbingScreen />}
        {step === "forked" && <ForkedScreen />}
        {step === "compare" && <CompareScreen />}
      </div>
      <div className="border-t-2 border-black bg-neutral-50 px-4 py-2 flex items-center justify-between text-xs text-neutral-600">
        <span>
          {step === "live" && "① Watch a live multiplayer session — humans + agent"}
          {step === "scrubbing" && "② Scrub the timeline to go back in time"}
          {step === "forked" && "③ Fork a new branch from any past point"}
          {step === "compare" && "④ Compare original vs fork side-by-side"}
        </span>
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => { setPaused(true); setStep(s); setTimeout(() => setPaused(false), 100); }}
              className={`h-2 w-2 rounded-full transition-colors ${
                s === step ? "bg-neutral-900 border border-neutral-900" : "bg-neutral-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

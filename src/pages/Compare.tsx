import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EventRow } from "@/pages/Session";
import type {
  EventData,
  SessionData,
} from "@/pages/Session";
import {
  ArrowLeft,
  GitBranch,
  Pause,
  Play,
  Radio,
  SkipBack,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "convex/react";

/** Shared replay tick, in ms per step. */
const TICK_MS = 320;

function Pane({
  label,
  session,
  events,
  uptoIndex,
}: {
  label: string;
  session: SessionData | undefined;
  events: EventData[] | undefined;
  uptoIndex: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () => (events ?? []).slice(0, uptoIndex + 1),
    [events, uptoIndex],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [uptoIndex]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="nb-border flex shrink-0 items-center gap-2 border-l-0 border-r-0 border-t-0 bg-card px-3 py-2">
        <span className="nb-border shrink-0 bg-secondary px-1.5 py-px text-[10px] font-black uppercase tracking-widest">
          {label}
        </span>
        <Link
          to={session ? `/session/${session._id}` : "#"}
          className="truncate text-xs font-bold underline decoration-2 underline-offset-2 hover:bg-secondary"
        >
          {session?.title ?? "..."}
        </Link>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-xl flex-col gap-3">
          {!events && (
            <p className="animate-pulse text-xs text-muted-foreground">
              Loading timeline...
            </p>
          )}
          {visible.map((ev) => (
            <EventRow key={`${ev._id}-${ev.seq}`} ev={ev} />
          ))}
          {events && visible.length === 0 && (
            <p className="self-center text-[11px] uppercase tracking-widest text-muted-foreground">
              Start of timeline
            </p>
          )}
        </div>
      </div>
      <div className="nb-border shrink-0 border-x-0 border-b-0 bg-card px-3 py-1 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {visible.length}/{events?.length ?? 0} events
      </div>
    </div>
  );
}

export default function Compare() {
  const { sessionIdA, sessionIdB } = useParams<{
    sessionIdA: string;
    sessionIdB: string;
  }>();
  const navigate = useNavigate();

  const sessionA = useQuery(
    api.sessions.getSession,
    sessionIdA ? { sessionId: sessionIdA as never } : "skip",
  ) as SessionData | null | undefined;
  const sessionB = useQuery(
    api.sessions.getSession,
    sessionIdB ? { sessionId: sessionIdB as never } : "skip",
  ) as SessionData | null | undefined;
  const eventsA = useQuery(
    api.events.listEvents,
    sessionIdA ? { sessionId: sessionIdA as never } : "skip",
  ) as EventData[] | undefined;
  const eventsB = useQuery(
    api.events.listEvents,
    sessionIdB ? { sessionId: sessionIdB as never } : "skip",
  ) as EventData[] | undefined;

  // Timeline sync: one shared progress value in [0,1]; each pane maps it onto
  // its own event count so timelines of different lengths stay aligned.
  const [progress, setProgress] = useState(1);
  const [replaying, setReplaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  const lenA = Math.max((eventsA?.length ?? 1) - 1, 0);
  const lenB = Math.max((eventsB?.length ?? 1) - 1, 0);

  // Replay via requestAnimationFrame so scrubbing feels fluid.
  useEffect(() => {
    if (!replaying) return;
    let last = performance.now();
    const step = (now: number) => {
      if (now - last >= TICK_MS) {
        last = now;
        setProgress((p) => Math.min(p + 1 / Math.max(lenA + lenB, 1), 1));
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [replaying, lenA, lenB]);

  useEffect(() => {
    if (progress >= 1) setReplaying(false);
  }, [progress]);

  const seekFraction = useCallback(
    (fraction: number) => {
      setReplaying(false);
      setProgress(Math.min(Math.max(fraction, 0), 1));
    },
    [],
  );

  const idxA = Math.round(progress * lenA);
  const idxB = Math.round(progress * lenB);

  const loading =
    sessionA === undefined ||
    sessionB === undefined ||
    eventsA === undefined ||
    eventsB === undefined;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="nb-border flex h-14 shrink-0 items-center gap-3 border-x-0 border-t-0 bg-card px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="nb-border h-8 bg-card px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-sm font-black uppercase tracking-tight sm:text-base">
          <GitBranch className="mr-1 inline size-4" />
          Compare sessions
        </h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Synced scrubber */}
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-accent px-4 py-2 sm:gap-3">
        <button
          onClick={() => seekFraction(0)}
          title="Jump to start"
          aria-label="Jump to start"
          className="nb-border nb-lift flex size-7 shrink-0 items-center justify-center bg-secondary"
        >
          <SkipBack className="size-3.5" />
        </button>
        <button
          onClick={() => setReplaying((r) => !r)}
          disabled={loading}
          aria-label={replaying ? "Pause replay" : "Replay both timelines"}
          className="nb-border nb-lift flex size-7 shrink-0 items-center justify-center bg-primary text-black"
        >
          {replaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => seekFraction(Number(e.target.value) / 1000)}
          aria-label="Scrub both timelines together"
          className="time-scrubber h-2 min-w-0 flex-1 cursor-pointer appearance-none border-2 border-foreground bg-secondary"
        />
        <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-widest sm:inline">
          {progress >= 1 ? (
            <>
              LIVE · synced
            </>
          ) : (
            <>POS {Math.round(progress * 100)}%</>
          )}
        </span>
        <Button
          size="sm"
          onClick={() => seekFraction(1)}
          className="nb-border nb-lift h-7 shrink-0 bg-[#4DA6FF] px-2 text-[10px] font-black text-black sm:px-3 sm:text-xs"
        >
          <Radio className="size-3.5" />
          Live
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="animate-pulse text-sm text-muted-foreground">
            Loading both timelines...
          </p>
        </div>
      ) : !sessionA || !sessionB ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="nb-border nb-shadow bg-card px-6 py-4 font-bold">
            One of these sessions no longer exists
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <Pane
            label={sessionB.parentId === sessionA._id ? "Original" : "A"}
            session={sessionA}
            events={eventsA}
            uptoIndex={idxA}
          />
          <div className="nb-border w-full shrink-0 border-b-0 border-l-2 border-r-0 border-t-0 md:w-0" />
          <Pane
            label={sessionB.parentId === sessionA._id ? "Fork" : "B"}
            session={sessionB}
            events={eventsB}
            uptoIndex={idxB}
          />
        </div>
      )}
    </div>
  );
}

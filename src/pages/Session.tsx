import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import ReviewGatePanel from "@/components/ReviewGatePanel";
import AwayBriefing from "@/components/AwayBriefing";
import HandoffDialog from "@/components/HandoffDialog";
import { STATE_STYLES, StatusChip } from "@/pages/Dashboard";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Eye,
  GitBranch,
  GitFork,
  History,
  Pause,
  Play,
  Radio,
  SkipBack,
  Shield,
  ShieldOff,
  Sparkles,
  Square,
  Wrench,
  Zap,
  CheckCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

const AGENT_NAME = "AI";
const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

// ---------- Smooth scrubber ----------
// The thumb/fill are painted via refs (no React re-render per pointer move) and
// the timeline preview updates live DURING the drag, throttled with RAF.
function TimeScrubber({
  value,
  max,
  onPreview,
  onCommit,
}: {
  value: number;
  max: number;
  onPreview: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const activePointer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingValue = useRef<number | null>(null);
  const lastPreviewed = useRef(value);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  const paint = useCallback((v: number) => {
    const pct = max > 0 ? (v / max) * 100 : 0;
    if (fillRef.current) fillRef.current.style.width = `${pct}%`;
    if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
  }, [max]);

  // Sync the visual to the React value when not dragging.
  useEffect(() => {
    if (dragging.current) return;
    paint(value);
  }, [value, paint]);

  const valueFromPointer = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return Math.round(pct * max);
  }, [max]);

  const flush = useCallback(() => {
    rafRef.current = null;
    if (pendingValue.current === null) return;
    const v = pendingValue.current;
    pendingValue.current = null;
    lastPreviewed.current = v;
    paint(v);
    onPreview(v);
  }, [paint, onPreview]);

  const schedule = useCallback((v: number) => {
    pendingValue.current = v;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  const startDrag = useCallback((clientX: number, pointerId: number) => {
    dragging.current = true;
    activePointer.current = pointerId;
    schedule(valueFromPointer(clientX));
  }, [schedule, valueFromPointer]);

  const endDrag = useCallback((commit: boolean, clientX: number | null) => {
    if (!dragging.current) return;
    dragging.current = false;
    activePointer.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // Paint any pending value we were about to show.
      if (pendingValue.current !== null) paint(pendingValue.current);
      pendingValue.current = null;
    }
    if (commit) {
      // If the browser never sent us a final position (touch/edge cases),
      // commit the last previewed value instead.
      const v = clientX !== null ? valueFromPointer(clientX) : lastPreviewed.current;
      onCommit(v);
    }
  }, [valueFromPointer, onCommit, paint]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div
      className="relative min-w-0 flex-1 py-2.5"
      onPointerDown={(e) => {
        if (max === 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        startDrag(e.clientX, e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current || activePointer.current !== e.pointerId) return;
        schedule(valueFromPointer(e.clientX));
      }}
      onPointerUp={(e) => {
        if (activePointer.current !== e.pointerId) return;
        endDrag(true, e.clientX);
      }}
      onPointerCancel={(e) => {
        if (activePointer.current !== e.pointerId) return;
        // A cancelled pointer (e.g. browser gesture takes over) must NOT seek.
        endDrag(false, null);
      }}
      onLostPointerCapture={(e) => {
        if (dragging.current && activePointer.current === e.pointerId) {
          endDrag(false, null);
        }
      }}
    >
      <div
        ref={trackRef}
        className="time-scrubber-track relative h-2 w-full touch-none select-none bg-secondary"
        role="slider"
        aria-label="Scrub session timeline"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0 bg-[#4DA6FF]"
          style={{ width: `${pct}%` }}
        />
        <div
          ref={thumbRef}
          className="time-scrubber-thumb absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${pct}%` }}
        />
        <span className="sr-only">
          Position {value + 1} of {max + 1}
        </span>
      </div>
    </div>
  );
}

export type SessionData = {
  _id: string;
  title: string;
  state: "running" | "paused" | "awaiting_input" | "done";
  joinCode: string;
  agentActivity?: string | null;
  createdAt?: number;
  // Time travel lineage
  parentId?: string | null;
  forkedAtSeq?: number | null;
  parentTitle?: string | null;
  autonomousScope?: string | null;
  lastActivityAt?: number;
  handoffCount?: number;
  participants: Array<{
    _id: string;
    userId: string;
    role: "driver" | "copilot" | "observer";
    name: string;
  }>;
};

export type EventData = {
  _id: string;
  seq: number;
  type:
    | "message"
    | "agent_message"
    | "agent_tool_call"
    | "intervention"
    | "system"
    | "summary"
    | "fork"
    | "proposal"
    | "gate_decision";
  authorType: "human" | "agent" | "system";
  authorName: string;
  content: string;
  promptedBy?: string | null;
  toolName?: string | null;
  childSessionId?: string | null;
};

type PresenceData = {
  tabId: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
  focus: string | null;
};

function Cursor({ p }: { p: PresenceData }) {
  return (
    <div
      className="pointer-events-none absolute z-30 transition-all duration-100 ease-linear"
      style={{
        left: `${p.cursorX * 100}%`,
        top: `${p.cursorY * 100}%`,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={p.color}
        stroke="#111"
        strokeWidth="1.5"
      >
        <path d="M4 2 L20 12 L12 13 L9 21 Z" />
      </svg>
      <span
        className="nb-border absolute top-3.5 left-3 whitespace-nowrap px-1 py-px text-[10px] font-bold text-black"
        style={{ background: p.color }}
      >
        {p.name}
        {p.focus ? ` · ${p.focus}` : ""}
      </span>
    </div>
  );
}

export default function Session() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const session = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId: sessionId as never } : "skip",
  ) as SessionData | null | undefined;
  const myPart = useQuery(
    api.sessions.myParticipant,
    sessionId ? { sessionId: sessionId as never } : "skip",
  );
  const events = useQuery(
    api.events.listEvents,
    sessionId ? { sessionId: sessionId as never } : "skip",
  ) as EventData[] | undefined;
  const presence = useQuery(
    api.presence.listPresence,
    sessionId ? { sessionId: sessionId as never } : "skip",
  ) as PresenceData[] | undefined;

  const postMessage = useMutation(api.events.postMessage);
  const heartbeat = useMutation(api.presence.heartbeat);
  const leavePresence = useMutation(api.presence.leave);
  const setMyRole = useMutation(api.sessions.setMyRole);
  const setSessionState = useMutation(api.sessions.setSessionState);
  const setAutonomousScope = useMutation(api.sessions.setAutonomousScope);
  const requestSummary = useMutation(api.events.requestSummary);
  const joinSessionMut = useMutation(api.sessions.joinSession);
  const forkSessionMut = useMutation(api.sessions.forkSession);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // Time travel: null = live edge, otherwise index into the events array.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [forking, setForking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastCursorSent = useRef(0);

  const myRole = myPart?.role ?? null;
  const isMember = !!myPart;
  const canPost = isMember && myRole !== "observer" && session?.state !== "done";

  // Auto-join when arriving via a direct link.
  useEffect(() => {
    if (sessionId && session && !isMember && myPart !== undefined) {
      void joinSessionMut({ sessionId: sessionId as never, role: "copilot" }).catch(() => {});
    }
  }, [sessionId, session, isMember, myPart, joinSessionMut]);

  // One-time catch-up summary for mid-session joiners.
  const summaryRequested = useRef(false);
  useEffect(() => {
    if (!sessionId || !events || !isMember || summaryRequested.current) return;
    const substantive = events.filter((e) => e.type !== "system").length;
    const hasSummary = events.some((e) => e.type === "summary");
    if (substantive >= 6 && !hasSummary) {
      summaryRequested.current = true;
      void requestSummary({ sessionId: sessionId as never }).catch(() => {});
    }
  }, [events, isMember, sessionId, requestSummary]);

  // Presence heartbeat + cursor broadcast.
  useEffect(() => {
    if (!sessionId || !isMember) return;
    let cursor = { x: 0.5, y: 0.5 };
    const beat = () =>
      void heartbeat({
        sessionId: sessionId as never,
        tabId: TAB_ID,
        cursorX: cursor.x,
        cursorY: cursor.y,
        focus: document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT"
          ? "typing"
          : undefined,
      }).catch(() => {});
    beat();
    const interval = setInterval(beat, 2500);
    return () => {
      clearInterval(interval);
      void leavePresence({ sessionId: sessionId as never, tabId: TAB_ID }).catch(() => {});
    };
  }, [sessionId, isMember, heartbeat, leavePresence]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!sessionId || !isMember) return;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
      const now = Date.now();
      if (now - lastCursorSent.current < 120) return;
      lastCursorSent.current = now;
      void heartbeat({
        sessionId: sessionId as never,
        tabId: TAB_ID,
        cursorX: x,
        cursorY: y,
      }).catch(() => {});
    },
    [sessionId, isMember, heartbeat],
  );

  // Autoscroll on new events.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events?.length]);

  const otherCursors = useMemo(
    () => (presence ?? []).filter((p) => p.tabId !== TAB_ID),
    [presence],
  );

  // ---- Time travel ----
  // All slicing is local state over the already-subscribed events array, so
  // dragging repaints instantly with zero network round-trips.
  const maxIndex = Math.max((events?.length ?? 1) - 1, 0);
  const effectiveIndex = viewIndex ?? maxIndex;
  const timeTraveling = viewIndex !== null && viewIndex < maxIndex;

  const visibleEvents = useMemo(
    () => (events ?? []).slice(0, effectiveIndex + 1),
    [events, effectiveIndex],
  );

  // Reconstruct what the session looked like at the scrub position: walk
  // backwards through the visible log for the last thing that changed state.
  const historicalState = useMemo<SessionData["state"] | null>(() => {
    if (!timeTraveling) return null;
    for (let i = visibleEvents.length - 1; i >= 0; i--) {
      const e = visibleEvents[i];
      if (e.type === "agent_message" || e.type === "agent_tool_call") return "running";
      if (e.type === "message" || e.type === "intervention") return "awaiting_input";
      if (e.type === "fork") return "awaiting_input";
      if (e.type === "system") {
        if (e.content.includes("paused the agent")) return "paused";
        if (e.content.includes("marked the session done")) return "done";
        if (e.content.includes("resumed the agent")) return "running";
      }
    }
    return "awaiting_input";
  }, [timeTraveling, visibleEvents]);

  const displayState = historicalState ?? session?.state ?? "awaiting_input";
  const agentActive =
    !timeTraveling &&
    (displayState === "running" ||
      (!!session?.agentActivity && displayState !== "paused"));

  // Replay animation: walk forward through history.
  useEffect(() => {
    if (!replaying) return;
    const t = setInterval(() => {
      setViewIndex((cur) => Math.min((cur ?? 0) + 1, maxIndex));
    }, 320);
    return () => clearInterval(t);
  }, [replaying, maxIndex]);
  // Reaching the newest event means we're live again — snap out of time travel
  // so the composer re-enables and no stale historical state lingers.
  useEffect(() => {
    if (viewIndex !== null && viewIndex >= maxIndex) {
      setReplaying(false);
      setViewIndex(null);
    }
  }, [viewIndex, maxIndex]);

  const seek = useCallback((i: number) => {
    setReplaying(false);
    setViewIndex(i);
  }, []);

  const handleFork = async () => {
    if (!sessionId || viewIndex === null || !events) return;
    setForking(true);
    try {
      const childId = await forkSessionMut({
        sessionId: sessionId as never,
        uptoSeq: events[viewIndex].seq,
      });
      toast.success("Branch created — fresh agent run started");
      navigate(`/session/${childId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fork failed");
      setForking(false);
    }
  };

  const handleSend = async () => {
    if (!sessionId || !draft.trim() || sending) return;
    setSending(true);
    try {
      await postMessage({ sessionId: sessionId as never, content: draft });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const copyShareLink = () => {
    if (!session) return;
    navigator.clipboard.writeText(`${window.location.origin}/session/${session._id}`);
    setCopiedLink(true);
    toast.success("Join link copied");
    setTimeout(() => setCopiedLink(false), 1500);
  };

  if (session === undefined || myPart === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-sm text-muted-foreground">
          Connecting to session...
        </p>
      </div>
    );
  }
  if (session === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="nb-border nb-shadow bg-card px-6 py-4 font-bold">
          Session not found
        </p>
        <Button onClick={() => navigate("/dashboard")} className="nb-border nb-lift bg-primary font-bold text-black">
          Back to sessions
        </Button>
      </div>
    );
  }

  const stateStyle = STATE_STYLES[displayState];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="nb-border flex h-11 shrink-0 items-center gap-2 border-x-0 border-t-0 bg-card px-2 sm:h-14 sm:gap-3 sm:px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="nb-border size-8 shrink-0 bg-card px-0 sm:px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="min-w-0 truncate text-xs font-black uppercase tracking-tight sm:text-sm md:text-base">
          {session.title}
        </h1>
        <StatusChip state={displayState} />
        {timeTraveling && (
          <span className="nb-border hidden items-center gap-1.5 bg-[#4DA6FF] px-2 py-0.5 text-[10px] font-bold text-black md:inline-flex">
            <History className="size-3 animate-pulse" />
            TIME TRAVEL
          </span>
        )}
        {agentActive && (
          <span className="nb-border hidden items-center gap-1.5 bg-[#D9F99D] px-2 py-0.5 text-[10px] font-bold lg:inline-flex">
            <Bot className="size-3 animate-pulse" />
            {session.agentActivity ?? `${AGENT_NAME} is working...`}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <span className="nb-border hidden bg-secondary px-2 py-1 text-[10px] font-bold lg:inline">
            CODE {session.joinCode}
          </span>
          {(myRole === "driver" || myRole === "copilot") &&
            session.state !== "done" && (
              <>
                {session.state === "paused" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      void setSessionState({
                        sessionId: session._id as never,
                        state: "awaiting_input",
                      })
                    }
                    className="nb-border nb-lift h-7 bg-[#D9F99D] font-bold text-black sm:h-8"
                  >
                    <Play className="size-3.5" /> <span className="hidden sm:inline">Resume</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      void setSessionState({
                        sessionId: session._id as never,
                        state: "paused",
                      })
                    }
                    className="nb-border nb-lift h-7 bg-[#FF9440] font-bold text-black sm:h-8"
                  >
                    <Pause className="size-3.5" /> <span className="hidden sm:inline">Pause</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void setSessionState({
                      sessionId: session._id as never,
                      state: "done",
                    })
                  }
                  className="nb-border nb-lift h-7 bg-card font-bold sm:h-8"
                >
                  Done
                </Button>
              </>
            )}
          <Button
            size="sm"
            onClick={copyShareLink}
            className="nb-border nb-lift h-7 bg-primary font-bold text-black sm:h-8"
          >
            {copiedLink ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span className="hidden sm:inline">Share</span>
          </Button>
          {myRole === "driver" && (
            <div className="relative hidden sm:block">
              <HandoffDialog
                sessionId={sessionId as string}
                participants={session.participants}
              />
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Time travel scrubber + controls — always visible at the top */}
      <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-t-0 bg-card px-3 py-2 sm:gap-3 sm:px-5">
        <button
          onClick={() => seek(0)}
          disabled={maxIndex === 0}
          title="Jump to start"
          aria-label="Jump to start of timeline"
          className="nb-border nb-lift flex size-7 shrink-0 items-center justify-center bg-secondary disabled:opacity-40"
        >
          <SkipBack className="size-3.5" />
        </button>
        <button
          onClick={() => setReplaying((r) => !r)}
          disabled={maxIndex === 0 || (!timeTraveling && viewIndex === null)}
          title={replaying ? "Pause replay" : "Replay from here"}
          aria-label={replaying ? "Pause replay" : "Replay timeline"}
          className="nb-border nb-lift flex size-7 shrink-0 items-center justify-center bg-primary text-black disabled:opacity-40"
        >
          {replaying ? <Square className="size-3" /> : <Play className="size-3.5" />}
        </button>
        <TimeScrubber
          value={effectiveIndex}
          max={maxIndex}
          onPreview={seek}
          onCommit={seek}
        />
        <span className="hidden w-28 shrink-0 text-right text-[10px] font-black uppercase tracking-widest tabular-nums sm:inline">
          {timeTraveling
            ? `POS ${effectiveIndex + 1}/${maxIndex + 1}`
            : `LIVE · ${maxIndex + 1} events`}
        </span>
        {/* Controls are always rendered in the same order/size so entering or
            leaving time travel never shifts the layout mid-drag. */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setViewIndex(Math.max(maxIndex - 1, 0))}
            disabled={maxIndex === 0}
            title="Step back one event"
            className="nb-border nb-lift h-7 w-7 shrink-0 bg-card px-0 text-[10px] font-bold sm:w-auto sm:px-3 sm:text-xs"
          >
            <History className="size-3.5" />
            <span className="hidden lg:inline">Rewind</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setReplaying(false);
              setViewIndex(null);
            }}
            disabled={!timeTraveling}
            title="Return to live"
            className="nb-border nb-lift h-7 w-7 shrink-0 bg-[#4DA6FF] px-0 text-[10px] font-black text-black disabled:opacity-40 sm:w-auto sm:px-3 sm:text-xs"
          >
            <Radio className="size-3.5" />
            <span className="hidden lg:inline">Live</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void handleFork()}
            disabled={!timeTraveling || forking}
            title="Fork from this point in time"
            className="nb-border nb-lift h-7 w-7 shrink-0 bg-[#B57BFF] px-0 text-[10px] font-black text-black disabled:opacity-40 sm:w-auto sm:px-3 sm:text-xs"
          >
            <GitFork className="size-3.5" />
            <span className="hidden lg:inline">Fork</span>
          </Button>
        </div>
      </div>

      {/* State legend strip */}
      <div
        className={`nb-border flex shrink-0 items-center justify-center gap-2 sm:gap-3 border-x-0 border-t-0 px-3 sm:px-4 py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${stateStyle.className}`}
      >
        <span>{stateStyle.label}</span>
        {agentActive && (
          <span className="flex items-center gap-1">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            live
          </span>
        )}
        {session.autonomousScope && session.autonomousScope !== "off" && (
          <span className="hidden items-center gap-1 sm:flex">
            <Zap className="size-2.5" />
            autonomous: {session.autonomousScope}
          </span>
        )}
        {(session.handoffCount ?? 0) > 0 && (
          <span className="hidden items-center gap-1 sm:flex">
            <GitFork className="size-2.5" />
            {session.handoffCount} handoff{(session.handoffCount ?? 0) !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Away briefing */}
      {!timeTraveling && (
        <AwayBriefing sessionId={sessionId as string} />
      )}

      {/* Fork lineage banner */}
      {session.parentId && (
        <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-t-0 bg-accent px-4 py-1.5 text-xs font-semibold">
          <GitFork className="size-3.5 shrink-0" />
          <span className="truncate">
            Forked from{" "}
            <Link
              to={`/session/${session.parentId}`}
              className="underline decoration-2 underline-offset-2 hover:bg-card"
            >
              {session.parentTitle ?? "parent session"}
            </Link>
            {session.forkedAtSeq != null && (
              <>
                {" "}at position {session.forkedAtSeq}
              </>
            )}
            {session.createdAt != null && (
              <>
                {" "}·{" "}
                {new Date(session.createdAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </>
            )}
          </span>
          <button
            onClick={() =>
              navigate(`/compare/${session.parentId}/${session._id}`)
            }
            className="nb-border nb-lift ml-auto shrink-0 bg-card px-2 py-0.5 text-[10px] font-bold"
          >
            Compare with original
          </button>
        </div>
      )}

      {/* Body */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="nb-border hidden flex-col overflow-y-auto border-b-0 border-l-0 bg-card lg:flex">
          <p className="border-b-2 border-foreground px-4 py-2.5 text-[10px] font-black uppercase tracking-widest">
            Participants · {(session.participants.length ?? 0)}
          </p>
          {/* Agent */}
          <div className="flex items-start gap-2.5 border-b-2 border-foreground px-4 py-3">
            <span
              className={`nb-border mt-0.5 flex size-7 shrink-0 items-center justify-center ${
                agentActive
                  ? "animate-pulse bg-primary"
                  : session.state === "paused"
                    ? "bg-[#FF9440]"
                    : "bg-secondary"
              }`}
            >
              <Bot className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">{AGENT_NAME} · AI agent</p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                {session.state === "running"
                  ? (session.agentActivity ?? "Acting now")
                  : session.state === "paused"
                    ? "Paused by the team"
                    : session.state === "done"
                      ? "Finished for this session"
                      : "Waiting for input"}
              </p>
            </div>
          </div>
          {session.participants.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-2.5 border-b border-foreground/10 px-4 py-2.5"
            >
              <span
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center nb-border text-[10px] font-black text-black"
                style={{ background: presenceColorFor(p.userId) }}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {p.role}
                </p>
              </div>
              {p.userId === myPart?.userId && (
                <select
                  value={p.role}
                  onChange={(e) =>
                    void setMyRole({
                      sessionId: session._id as never,
                      role: e.target.value as "driver" | "copilot" | "observer",
                    })
                  }
                  className="cursor-pointer nb-border bg-card px-1 py-0.5 text-[10px] font-bold"
                  aria-label="Change your role"
                >
                  <option value="driver">→ driver</option>
                  <option value="copilot">→ co-pilot</option>
                  <option value="observer">→ observer</option>
                </select>
              )}
            </div>
          ))}

          {(myRole === "driver" || myRole === "copilot") && (
            <div className="border-t border-foreground/10 p-4">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Zap className="mr-1 inline size-3" />
                Autonomous mode
              </p>
              <div className="flex gap-1">
                {["off", "research_only", "full"].map((scope) => (
                  <button
                    key={scope}
                    onClick={() =>
                      void setAutonomousScope({
                        sessionId: session._id as never,
                        scope,
                      })
                    }
                    className={`nb-border flex-1 px-1.5 py-1 text-[9px] font-bold ${
                      (session.autonomousScope ?? "off") === scope
                        ? "bg-primary text-black"
                        : "bg-background hover:bg-secondary"
                    }`}
                  >
                    {scope === "off" ? "Off" : scope === "research_only" ? "Research" : "Full"}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground">
                Agent continues working when no one is present.
              </p>
            </div>
          )}

          <div className="mt-auto p-4">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <Eye className="mr-1 inline size-3" />
              Observers are read-only and can request control at any time.
            </p>
          </div>
        </aside>

        {/* Stage */}
        <div
          ref={stageRef}
          onMouseMove={onMouseMove}
          className="relative flex flex-col overflow-hidden bg-background"
        >
          {/* Live cursors overlay */}
          <div className="pointer-events-none absolute inset-0 z-30">
            {otherCursors.map((p) => (
              <Cursor key={p.tabId} p={p} />
            ))}
          </div>

          {/* Timeline */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {events === undefined && (
                <p className="animate-pulse text-xs text-muted-foreground">
                  Loading timeline...
                </p>
              )}
              {events?.length === 0 && (
                <div className="nb-border nb-shadow mx-auto mt-10 max-w-md bg-card p-6 text-center">
                  <p className="font-bold">Kick things off</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Post a message and include{" "}
                    <code className="bg-secondary px-1 font-bold">@agent</code>{" "}
                    to bring the agent into the conversation.
                  </p>
                </div>
              )}
              {visibleEvents.map((ev) => (
                <EventRow key={`${ev._id}-${ev.seq}`} ev={ev} />
              ))}
              {timeTraveling && (
                <p className="self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  ↓ future events hidden · position {effectiveIndex + 1}/{maxIndex + 1}
                </p>
              )}
            </div>
          </div>

          {/* Review gates */}
          {!timeTraveling && (
            <div className="mx-auto max-w-2xl px-4 sm:px-8">
              <ReviewGatePanel sessionId={sessionId as never} />
            </div>
          )}          {/* Composer */}
          <div className="nb-border shrink-0 border-x-0 border-b-0 bg-card px-3 py-2 sm:px-6 sm:py-3">
            <form
              className="mx-auto flex max-w-2xl gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!canPost || timeTraveling}
                placeholder={
                  !isMember
                    ? "Joining..."
                    : myRole === "observer"
                      ? "Read-only"
                      : timeTraveling
                        ? "Time traveling — go LIVE to post"
                        : displayState === "done"
                          ? "Session done"
                          : "Message. Use @agent to prompt the AI."
                }
                className="nb-border h-9 sm:h-10 flex-1 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:shadow-[2px_2px_0_0_#111] dark:focus:shadow-[2px_2px_0_0_#f5f5f0]"
              />
              {canPost && !timeTraveling ? (
                <Button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="nb-border nb-lift h-9 sm:h-10 bg-primary px-3 sm:px-5 font-black text-black"
                >
                  Send
                </Button>
              ) : !timeTraveling && (
                myRole === "observer" && (
                  <Button
                    type="button"
                    onClick={() =>
                      void setMyRole({
                        sessionId: session._id as never,
                        role: "copilot",
                      })
                    }
                    className="nb-border nb-lift h-9 sm:h-10 bg-accent px-3 sm:px-5 font-black"
                  >
                    Control
                  </Button>
                )
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventRow({ ev }: { ev: EventData }) {
  switch (ev.type) {
    case "message":
      return (
        <div className="max-w-[85%] self-start">
          <p className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
            {ev.authorName}
          </p>
          <div className="nb-border nb-shadow-sm w-fit bg-card px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
            {ev.content}
          </div>
        </div>
      );
    case "agent_message":
      return (
        <div className="max-w-[85%] self-end">
          <p className="mb-0.5 text-right text-[10px] font-black tracking-wide text-muted-foreground">
            <span className="rounded-none bg-primary px-1 py-px text-black">
              {AGENT_NAME.toUpperCase()}
            </span>
            {ev.promptedBy ? (
              <span className="ml-1 normal-case">prompted by @{ev.promptedBy}</span>
            ) : null}
          </p>
          <div className="nb-border nb-shadow-sm w-fit bg-primary/90 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
            {ev.content}
          </div>
        </div>
      );
    case "agent_tool_call":
      return (
        <div className="self-center">
          <div className="nb-border flex w-fit items-center gap-2 bg-secondary px-3 py-1.5 text-xs">
            <Wrench className="size-3.5" />
            <span className="font-mono">{ev.content}</span>
          </div>
          {ev.promptedBy && (
            <p className="mt-0.5 text-center text-[10px] text-muted-foreground">
              prompted by @{ev.promptedBy}
            </p>
          )}
        </div>
      );
    case "intervention":
      return (
        <div className="self-center">
          <div className="nb-border w-fit bg-[#FFD9B3] px-3 py-1.5 text-xs font-semibold text-black">
            ⚡ {ev.content}
          </div>
        </div>
      );
    case "summary":
      return (
        <div className="nb-border nb-shadow bg-accent px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="size-3.5" />
            Catch-up summary by AI
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{ev.content}</p>
        </div>
      );
    case "fork":
      return (
        <div className="self-center">
          <div className="nb-border nb-shadow-sm flex w-fit items-center gap-2 bg-[#B57BFF] px-3 py-1.5 text-xs font-bold text-black">
            <GitBranch className="size-3.5 shrink-0" />
            <span>
              ⑂ {ev.authorName} {ev.content}
            </span>
            {ev.childSessionId && (
              <Link
                to={`/session/${ev.childSessionId}`}
                className="nb-border ml-1 shrink-0 bg-card px-1.5 py-px text-[10px] font-black hover:bg-secondary"
              >
                View branch →
              </Link>
            )}
          </div>
        </div>
      );
    case "proposal":
      return (
        <div className="max-w-[85%] self-center">
          <div className="nb-border nb-shadow-sm flex w-fit items-center gap-2 bg-[#FFD400] px-3 py-1.5 text-xs font-bold text-black">
            <Shield className="size-3.5" />
            <span>{ev.content}</span>
          </div>
          {ev.promptedBy && (
            <p className="mt-0.5 text-center text-[10px] text-muted-foreground">
              prompted by @{ev.promptedBy}
            </p>
          )}
        </div>
      );
    case "gate_decision":
      return (
        <div className="max-w-[85%] self-center">
          <div className="nb-border nb-shadow-sm flex w-fit items-center gap-2 bg-[#4DA6FF] px-3 py-1.5 text-xs font-bold text-black">
            {ev.content.includes("approved") ? (
              <CheckCircle className="size-3.5" />
            ) : ev.content.includes("rejected") ? (
              <ShieldOff className="size-3.5" />
            ) : (
              <Check className="size-3.5" />
            )}
            <span>{ev.authorName} {ev.content}</span>
          </div>
        </div>
      );
    case "system":
    default:
      return (
        <p className="self-center text-[11px] font-medium text-muted-foreground">
          {ev.authorName !== "System" ? ev.authorName : ""} {ev.content}
        </p>
      );
  }
}

// Deterministic avatar colors per user id.
const AVATAR_COLORS = ["#FF5C5C", "#4DA6FF", "#2ECC71", "#B57BFF", "#FF9440", "#00C2C7"];
function presenceColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

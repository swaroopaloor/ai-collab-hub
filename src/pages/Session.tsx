import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { STATE_STYLES, StatusChip } from "@/pages/Dashboard";
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Eye,
  Pause,
  Play,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

const AGENT_NAME = "ox-alpha";
const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

type SessionData = {
  _id: string;
  title: string;
  state: "running" | "paused" | "awaiting_input" | "done";
  joinCode: string;
  agentActivity?: string | null;
  participants: Array<{
    _id: string;
    userId: string;
    role: "driver" | "copilot" | "observer";
    name: string;
  }>;
};

type EventData = {
  _id: string;
  seq: number;
  type: "message" | "agent_message" | "agent_tool_call" | "intervention" | "system" | "summary";
  authorType: "human" | "agent" | "system";
  authorName: string;
  content: string;
  promptedBy?: string | null;
  toolName?: string | null;
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
  const requestSummary = useMutation(api.events.requestSummary);
  const joinSessionMut = useMutation(api.sessions.joinSession);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
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

  const stateStyle = STATE_STYLES[session.state];
  const agentActive =
    session.state === "running" ||
    (!!session.agentActivity && session.state !== "paused");

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
        <h1 className="truncate text-sm font-black uppercase tracking-tight sm:text-base">
          {session.title}
        </h1>
        <StatusChip state={session.state} />
        {agentActive && (
          <span className="nb-border hidden items-center gap-1.5 bg-[#D9F99D] px-2 py-0.5 text-[10px] font-bold sm:inline-flex">
            <Bot className="size-3 animate-pulse" />
            {session.agentActivity ?? `${AGENT_NAME} is working...`}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="nb-border hidden bg-secondary px-2 py-1 text-[10px] font-bold md:inline">
            CODE {session.joinCode}
          </span>          {(myRole === "driver" || myRole === "copilot") &&
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
                    className="nb-border nb-lift h-8 bg-[#D9F99D] font-bold text-black"
                  >
                    <Play className="size-3.5" /> Resume
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
                    className="nb-border nb-lift h-8 bg-[#FF9440] font-bold text-black"
                  >
                    <Pause className="size-3.5" /> Pause agent
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
                  className="nb-border nb-lift h-8 bg-card font-bold"
                >
                  Done
                </Button>
              </>
            )}
          <Button
            size="sm"
            onClick={copyShareLink}
            className="nb-border nb-lift h-8 bg-primary font-bold text-black"
          >
            {copiedLink ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            Share
          </Button>
          <ThemeToggle />
        </div>
      </header>

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
                    <code className="bg-secondary px-1 font-bold">@ox-alpha</code>{" "}
                    to bring the agent into the conversation.
                  </p>
                </div>
              )}
              {events?.map((ev) => (
                <EventRow key={ev._id} ev={ev} />
              ))}
            </div>
          </div>

          {/* Composer */}
          <div className="nb-border shrink-0 border-x-0 border-b-0 bg-card px-4 py-3 sm:px-8">
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
                disabled={!canPost}
                placeholder={
                  !isMember
                    ? "Joining..."
                    : myRole === "observer"
                      ? "Read-only — request control below to post"
                      : session.state === "done"
                        ? "This session is done"
                        : "Message everyone. Use @ox-alpha to prompt the agent."
                }
                className="nb-border h-10 flex-1 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:shadow-[2px_2px_0_0_#111] dark:focus:shadow-[2px_2px_0_0_#f5f5f0]"
              />
              {canPost ? (
                <Button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="nb-border nb-lift h-10 bg-primary px-5 font-black text-black"
                >
                  Send
                </Button>
              ) : (
                myRole === "observer" && (
                  <Button
                    type="button"
                    onClick={() =>
                      void setMyRole({
                        sessionId: session._id as never,
                        role: "copilot",
                      })
                    }
                    className="nb-border nb-lift h-10 bg-accent px-5 font-black"
                  >
                    Request control
                  </Button>
                )
              )}
            </form>
          </div>

          {/* State legend strip */}
          <div
            className={`nb-border shrink-0 border-x-0 border-b-0 px-4 py-1 text-center text-[10px] font-black uppercase tracking-widest ${stateStyle.className}`}
          >
            {stateStyle.label}
            {agentActive && " · live"}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: EventData }) {
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
            Catch-up summary by ox-alpha
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{ev.content}</p>
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

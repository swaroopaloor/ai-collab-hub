import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Activity,
  ArrowLeft,
  Bot,
  Clock,
  Eye,
  GitFork,
  MessageCircle,
  Pause,
  Play,
  Radio,
  ShieldHalf,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { useMemo } from "react";

type SessionCard = {
  _id: string;
  title: string;
  state: "running" | "paused" | "awaiting_input" | "done";
  joinCode: string;
  agentActivity: string | null;
  createdAt: number;
  participantCount: number;
  participantNames: Array<{ name: string; role: string }>;
  isMember: boolean;
  handoffCount?: number;
  autonomousScope?: string | null;
};

type FeedEvent = {
  _id: string;
  sessionId: string;
  sessionTitle: string;
  seq: number;
  type: string;
  authorType: string;
  authorName: string;
  content: string;
  createdAt: number;
};

const STATE_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Play; pulse: boolean }
> = {
  running: {
    label: "RUNNING",
    color: "bg-[#2ECC71]",
    icon: Play,
    pulse: true,
  },
  paused: {
    label: "PAUSED",
    color: "bg-[#FF9440]",
    icon: Pause,
    pulse: false,
  },
  awaiting_input: {
    label: "AWAITING INPUT",
    color: "bg-[#FFD400]",
    icon: Eye,
    pulse: false,
  },
  done: {
    label: "DONE",
    color: "bg-secondary",
    icon: ShieldHalf,
    pulse: false,
  },
};

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(createdAt: number): string {
  const ms = Date.now() - createdAt;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${mins}m`;
}

function SessionCardView({
  session,
  navigate,
}: {
  session: SessionCard;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const cfg = STATE_CONFIG[session.state] ?? STATE_CONFIG.awaiting_input;
  const StatusIcon = cfg.icon;
  const isAgentActive =
    session.state === "running" && !!session.agentActivity;

  return (
    <button
      onClick={() => navigate(`/session/${session._id}`)}
      className="nb-border nb-shadow nb-lift flex w-full flex-col bg-card p-4 text-left"
    >
      {/* Top row: title + state */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate font-black uppercase">{session.title}</h3>
        <span
          className={`nb-border flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[9px] font-black ${cfg.color}`}
        >
          <StatusIcon className={`size-2.5 ${cfg.pulse ? "animate-pulse" : ""}`} />
          {cfg.label}
        </span>
      </div>

      {/* Agent activity */}
      {isAgentActive && (
        <div className="mt-2 flex items-center gap-1.5">
          <Bot className="size-3.5 animate-pulse text-[#2ECC71]" />
          <span className="max-w-full truncate text-[11px] font-medium text-muted-foreground">
            {session.agentActivity}
          </span>
        </div>
      )}
      {!isAgentActive && session.state === "paused" && (
        <div className="mt-2 flex items-center gap-1.5">
          <Pause className="size-3.5 text-[#FF9440]" />
          <span className="text-[11px] font-medium text-muted-foreground">
            Paused by team
          </span>
        </div>
      )}

      {/* Participants */}
      <div className="mt-auto pt-3">
        <div className="flex items-center gap-1.5">
          <Users className="size-3 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground">
            {session.participantCount} participant{session.participantCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {session.participantNames.slice(0, 5).map((p, i) => (
            <span
              key={`${p.name}-${i}`}
              className="nb-border inline-flex items-center gap-0.5 bg-background px-1.5 py-0.5 text-[9px] font-bold"
            >
              <span
                className="inline-block size-1.5 rounded-full"
                style={{
                  background:
                    p.role === "driver"
                      ? "#2ECC71"
                      : p.role === "copilot"
                        ? "#4DA6FF"
                        : "#FF9440",
                }}
              />
              {p.name}
            </span>
          ))}
          {session.participantNames.length > 5 && (
            <span className="nb-border inline-flex bg-background px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
              +{session.participantNames.length - 5}
            </span>
          )}
        </div>
      </div>

      {/* Footer meta */}
      <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-2">
        <span className="nb-border bg-secondary px-1.5 py-0.5 text-[9px] font-bold">
          CODE {session.joinCode}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {(session.handoffCount ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 font-bold">
              <GitFork className="size-2.5" />
              {session.handoffCount} handoff{(session.handoffCount ?? 0) !== 1 ? "s" : ""}
            </span>
          )}
          <span className="font-bold">
            Running for {formatDuration(session.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

function FeedRow({ event }: { event: FeedEvent }) {
  const iconMap: Record<string, typeof Play> = {
    system: Users,
    message: MessageCircle,
    agent_message: Bot,
    agent_tool_call: Wrench,
    intervention: Zap,
    summary: Eye,
    fork: GitFork,
  };
  const Icon = iconMap[event.type] ?? Users;

  const colorMap: Record<string, string> = {
    system: "bg-secondary",
    message: "bg-[#4DA6FF]",
    agent_message: "bg-[#2ECC71]",
    agent_tool_call: "bg-secondary",
    intervention: "bg-[#FF9440]",
    summary: "bg-[#B57BFF]",
    fork: "bg-[#B57BFF]",
  };

  return (
    <div className="flex items-start gap-2 border-b border-foreground/10 py-2 last:border-b-0">
      <span
        className={`nb-border mt-0.5 flex size-5 shrink-0 items-center justify-center ${colorMap[event.type] ?? "bg-secondary"}`}
      >
        <Icon className="size-2.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] leading-tight">
          <span className="font-bold">{event.authorName}</span>{" "}
          <span className="text-muted-foreground">{event.content}</span>
        </p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          in <span className="font-bold">{event.sessionTitle}</span> · {timeAgo(event.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function Radar() {
  const navigate = useNavigate();

  const sessions = useQuery(api.radar.allSessions) as SessionCard[] | undefined;
  const feedEvents = useQuery(api.radar.recentEvents) as FeedEvent[] | undefined;

  const activeSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((s) => s.state !== "done");
  }, [sessions]);

  const doneSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((s) => s.state === "done");
  }, [sessions]);

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
        <div className="flex items-center gap-2">
          <span className="nb-border flex size-7 items-center justify-center bg-[#2ECC71] text-xs font-black text-black">
            <Radio className="size-4 animate-pulse" />
          </span>
          <h1 className="text-sm font-black uppercase tracking-tight sm:text-base">
            Radar
          </h1>
        </div>
        <span className="nb-border hidden bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-widest sm:inline">
          mission control
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="nb-border nb-lift h-8 bg-card px-3 text-[11px] font-bold"
          >
            My sessions
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Stats strip */}
      <div className="nb-border flex shrink-0 items-center gap-4 overflow-x-auto border-x-0 border-b-0 bg-accent px-4 py-1.5">
        <span className="nb-border flex shrink-0 items-center gap-1 bg-[#2ECC71] px-2 py-0.5 text-[10px] font-black text-black">
          <Play className="size-2.5" />
          {activeSessions.filter((s) => s.state === "running").length} running
        </span>
        <span className="nb-border flex shrink-0 items-center gap-1 bg-[#FF9440] px-2 py-0.5 text-[10px] font-black text-black">
          <Pause className="size-2.5" />
          {activeSessions.filter((s) => s.state === "paused").length} paused
        </span>
        <span className="nb-border flex shrink-0 items-center gap-1 bg-[#FFD400] px-2 py-0.5 text-[10px] font-black text-black">
          <Eye className="size-2.5" />
          {activeSessions.filter((s) => s.state === "awaiting_input").length} awaiting
        </span>
        <span className="nb-border flex shrink-0 items-center gap-1 bg-secondary px-2 py-0.5 text-[10px] font-black">
          {sessions?.length ?? 0} total
        </span>
        <span className="nb-border flex shrink-0 items-center gap-1 bg-secondary px-2 py-0.5 text-[10px] font-black">
          <Users className="size-2.5" />
          {sessions?.reduce((sum, s) => sum + s.participantCount, 0) ?? 0} people
        </span>
      </div>

      {/* Body: grid + feed */}
      <div className="flex flex-1 overflow-hidden">
        {/* Session grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sessions === undefined ? (
            <div className="flex items-center justify-center py-20">
              <p className="animate-pulse text-sm text-muted-foreground">
                Loading radar...
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="nb-border nb-shadow mx-auto max-w-md bg-card p-8 text-center">
              <Radio className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-bold">No sessions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first session to see it appear on the radar.
              </p>
              <Button
                onClick={() => navigate("/dashboard")}
                className="nb-border nb-lift mt-4 bg-primary font-bold text-black"
              >
                Create session
              </Button>
            </div>
          ) : (
            <>
              {/* Active sessions */}
              {activeSessions.length > 0 && (
                <div className="mb-6">
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <Radio className="size-3.5 text-[#2ECC71]" />
                    Active sessions · {activeSessions.length}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {activeSessions.map((s) => (
                      <SessionCardView
                        key={s._id}
                        session={s}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Done sessions */}
              {doneSessions.length > 0 && (
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                    <ShieldHalf className="size-3.5" />
                    Completed · {doneSessions.length}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {doneSessions.map((s) => (
                      <SessionCardView
                        key={s._id}
                        session={s}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Activity feed */}
        <aside className="nb-border hidden w-72 shrink-0 flex-col overflow-y-auto border-l-0 border-t-0 bg-card lg:flex xl:w-80">
          <div className="nb-border sticky top-0 z-10 flex items-center gap-2 border-b-2 border-foreground bg-card px-4 py-2.5">
            <Activity className="size-3.5" />
            <p className="text-[10px] font-black uppercase tracking-widest">
              Activity feed
            </p>
            {feedEvents && (
              <span className="nb-border ml-auto bg-secondary px-1.5 py-0.5 text-[9px] font-bold">
                {feedEvents.length}
              </span>
            )}
          </div>
          <div className="flex-1 px-4">
            {feedEvents === undefined ? (
              <p className="py-4 text-center text-xs text-muted-foreground animate-pulse">
                Loading events...
              </p>
            ) : feedEvents.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No activity yet
              </p>
            ) : (
              feedEvents.map((e) => <FeedRow key={e._id} event={e} />)
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

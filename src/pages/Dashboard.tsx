import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  LogOut,
  Plus,
  Users,
  Brain,
  Hash,
  Radio,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type SessionRow = {
  _id: Id<"sessions">;
  title: string;
  state: "running" | "paused" | "awaiting_input" | "done";
  joinCode: string;
  createdAt: number;
  participantCount: number;
  isMember: boolean;
};

export const STATE_STYLES: Record<
  SessionRow["state"],
  { label: string; className: string; dot: string }
> = {
  running: {
    label: "AGENT RUNNING",
    className: "bg-[#2ECC71] text-black",
    dot: "#0B6B37",
  },
  paused: {
    label: "PAUSED",
    className: "bg-[#FF9440] text-black",
    dot: "#7A3D00",
  },
  awaiting_input: {
    label: "AWAITING INPUT",
    className: "bg-primary text-black",
    dot: "#8A6D00",
  },
  done: {
    label: "DONE",
    className: "bg-[#E5E5DF] text-black dark:bg-[#3a3a3a]",
    dot: "#55554F",
  },
};

export function StatusChip({ state }: { state: SessionRow["state"] }) {
  const s = STATE_STYLES[state];
  return (
    <span
      className={`nb-border inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold tracking-wide ${s.className}`}
    >
      <span className="size-1.5" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const sessions = useQuery(api.sessions.listSessions) as
    | SessionRow[]
    | undefined;
  const createSession = useMutation(api.sessions.createSession);
  const seedDemo = useMutation(api.seed.seedDemoData);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Auto-seed demo data on first load.
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current && sessions !== undefined && sessions.length === 0) {
      seeded.current = true;
      void seedDemo().catch(() => {});
    }
  }, [sessions, seedDemo]);

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const id = await createSession({ title });
      navigate(`/session/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
      setCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    // Look up via the public list to avoid a dedicated query round-trip.
    toast.info(`Opening ${joinCode.toUpperCase()}...`);
    navigate(`/session/join/${joinCode.toUpperCase().trim()}`);
  };

  const copyLink = (session: SessionRow) => {
    const url = `${window.location.origin}/session/${session._id}`;
    navigator.clipboard.writeText(url);
    setCopied(session._id);
    toast.success("Join link copied");
    setTimeout(() => setCopied(null), 1500);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="nb-border sticky top-0 z-20 flex h-14 items-center justify-between border-x-0 border-t-0 bg-card px-4 sm:px-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2"
        >
          <span className="nb-border nb-shadow-sm flex size-7 items-center justify-center bg-primary text-xs font-black">
            M/
          </span>
          <span className="text-sm font-black tracking-tight uppercase">
            Multiplayer
          </span>
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-medium text-muted-foreground sm:block">
            {user?.name ?? user?.email ?? "Guest"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/radar")}
            className="nb-border gap-1.5 bg-card px-2.5 text-xs font-bold"
          >
            <Radio className="size-3.5" />
            Radar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/memory")}
            className="nb-border gap-1.5 bg-card px-2.5 text-xs font-bold"
          >
            <Brain className="size-3.5" />
            Memory
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/knowledge-base")}
            className="nb-border gap-1.5 bg-card px-2.5 text-xs font-bold"
          >
            <BookOpen className="size-3.5" />
            Knowledge Base
          </Button>
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="nb-border gap-1.5 bg-card px-2.5 text-xs font-bold"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Sessions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live rooms where your team and an AI teammate work in one shared thread.
        </p>

        {/* Create / Join panel */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="nb-border nb-shadow bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide">
              New chat room session
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 launch brainstorm"
                className="nb-border h-10 bg-background shadow-none"
              />
              <Button
                type="submit"
                disabled={!title.trim() || creating}
                className="nb-border nb-lift h-10 bg-primary px-4 font-bold text-black"
              >
                <Plus className="size-4" />
                Create
              </Button>
            </form>
          </div>

          <div className="nb-border nb-shadow bg-accent p-4">
            <p className="text-xs font-bold uppercase tracking-wide">
              Join with a code
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void handleJoinByCode();
              }}
            >
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="nb-border h-10 bg-card uppercase placeholder:normal-case"
              />
              <Button
                type="submit"
                disabled={joinCode.length < 4}
                className="nb-border nb-lift h-10 bg-card px-4 font-bold"
              >
                Join
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Session list */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions === undefined && (
            <p className="animate-pulse text-sm text-muted-foreground">
              Loading sessions...
            </p>
          )}
          {sessions?.length === 0 && (
            <div className="nb-border col-span-full bg-card p-8 text-center">
              <p className="font-bold">No sessions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one above and share the join link with your team.
              </p>
            </div>
          )}
          {sessions?.map((s) => (
            <div
              key={s._id}
              className="nb-border nb-shadow nb-lift flex cursor-pointer flex-col bg-card p-4"
              onClick={() => navigate(`/session/${s._id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold leading-snug">{s.title}</h3>
                <StatusChip state={s.state} />
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" />
                  {s.participantCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Hash className="size-3.5" />
                  {s.joinCode}
                </span>
                <span className="ml-auto rounded-none bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase">
                  Chat Room
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  className="nb-border nb-lift h-8 flex-1 bg-primary font-bold text-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/session/${s._id}`);
                  }}
                >
                  {s.isMember ? "Open" : "Join"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="nb-border nb-lift h-8 bg-card px-2.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyLink(s);
                  }}
                >
                  {copied === s._id ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

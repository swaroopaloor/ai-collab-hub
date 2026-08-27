import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import TimeTravelDemo from "@/components/TimeTravelDemo";
import GuidedDemo from "@/components/GuidedDemo";
import {
  ArrowRight,
  Brain,
  Bot,
  Clock,
  Eye,
  GitBranch,
  GitFork,
  History,
  MousePointer2,
  Play,
  Radio,
  Shield,
  ShieldHalf,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router";

const FEATURES = [
  {
    icon: MousePointer2,
    color: "#FF5C5C",
    title: "Live presence",
    body: "Every cursor and focus state broadcast in real time. You always know who is looking at what.",
  },
  {
    icon: Bot,
    color: "#FFD400",
    title: "AI in the thread",
    body: "@mention the agent to pull it in. Every action attributed to who prompted it.",
  },
  {
    icon: Zap,
    color: "#4DA6FF",
    title: "Interrupt anytime",
    body: "Send a message mid-turn to redirect the agent. It folds your interruption in seamlessly.",
  },
  {
    icon: History,
    color: "#2ECC71",
    title: "Time travel",
    body: "Scrub the timeline to any past moment, then fork a fresh branch from there.",
  },
  {
    icon: GitBranch,
    color: "#B57BFF",
    title: "Fork & compare",
    body: "Branch sessions like code. Compare what-ifs side by side with synced timelines.",
  },
  {
    icon: Shield,
    color: "#FF9440",
    title: "Approval gates",
    body: "Agent proposes changes that pause for review. Diff UI, edit-before-approve, reject with comment.",
  },
  {
    icon: Radio,
    color: "#00C2C7",
    title: "Radar dashboard",
    body: "Org-wide mission control. See every active session, who's in it, and what the agent is doing.",
  },
  {
    icon: Brain,
    color: "#B57BFF",
    title: "Team memory",
    body: "Agents learn durable facts across sessions. Searchable, editable, cited in future conversations.",
  },
  {
    icon: Clock,
    color: "#2ECC71",
    title: "Continuous sessions",
    body: "Agent keeps working autonomously across handoffs. \"While you were away\" briefings on return.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="nb-border sticky top-0 z-20 border-x-0 border-t-0 bg-card px-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="nb-border nb-shadow-sm flex size-8 items-center justify-center bg-primary text-sm font-black">
              M/
            </span>
            <span className="text-base font-black uppercase tracking-tight">
              Multiplayer
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
              className="nb-border nb-lift h-10 px-5 text-sm font-black"
            >
              {isAuthenticated ? "Open app" : "Start free"}
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 py-20 lg:grid-cols-[1.15fr_1fr] lg:py-28">
          <div>
            <span className="nb-border inline-block bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-widest">
              Humans + AI · one live session
            </span>
            <h1 className="mt-6 text-6xl font-black leading-[0.9] tracking-tight sm:text-7xl">
              Multiplayer
              <br />
              for AI agents.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              AI tasks take hours, not seconds. Your whole team should be able to
              <strong> watch, steer, and share</strong> the work — not just one
              person in a private chat window.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                className="nb-border nb-lift h-14 px-8 text-lg font-black"
              >
                Create a session
                <ArrowRight className="ml-2 size-5" />
              </Button>
              <GuidedDemo />
            </div>
          </div>

          {/* Hero mock */}
          <div className="nb-border nb-shadow overflow-hidden bg-card">
            <div className="nb-border flex h-12 items-center gap-2.5 border-x-0 border-t-0 bg-secondary px-4">
              <span className="size-2.5 bg-[#FF5C5C]" />
              <span className="size-2.5 bg-[#FFD400]" />
              <span className="size-2.5 bg-[#2ECC71]" />
              <span className="ml-2 text-xs font-black uppercase tracking-widest">
                launch-war-room · running
              </span>
            </div>
            <div className="relative space-y-4 p-5 text-sm">
              <div className="max-w-[80%]">
                <p className="mb-1 text-xs font-black uppercase text-muted-foreground">
                  Maya
                </p>
                <div className="nb-border nb-shadow-sm w-fit bg-background px-3 py-2">
                  @agent can you check why signups dipped this week?
                </div>
              </div>
              <div className="max-w-[85%] justify-end justify-self-end text-right">
                <p className="mb-1 text-xs font-black uppercase text-muted-foreground">
                  <span className="bg-primary px-1.5 py-0.5 text-black">AGENT</span>{" "}
                  prompted by @maya
                </p>
                <div className="nb-border nb-shadow-sm ml-auto w-fit bg-primary/90 px-3 py-2 text-left">
                  On it — pulling the signup funnel now.
                </div>
              </div>
              <div className="flex justify-center">
                <div className="nb-border flex items-center gap-2 bg-secondary px-3 py-1.5 font-mono text-xs">
                  <Bot className="size-4 animate-pulse" />
                  search_knowledge_base(&quot;signup dip&quot;)
                </div>
              </div>
              <div className="flex max-w-[70%] items-start gap-1.5">
                <MousePointer2 className="mt-0.5 size-5 shrink-0 text-[#B57BFF]" />
                <span className="nb-border bg-[#B57BFF] px-2 py-1 text-xs font-bold text-black">
                  Jonas · typing
                </span>
              </div>
              <div className="flex items-center gap-1.5 pl-6">
                <MousePointer2 className="size-5 text-[#FF9440]" />
                <span className="nb-border bg-[#FF9440] px-2 py-1 text-xs font-bold text-black">
                  Priya
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="pb-20">
          <h2 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
            Everything your team needs
          </h2>
          <p className="mt-3 max-w-lg text-base text-muted-foreground">
            One platform where humans and AI collaborate live, with full
            visibility and control.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="nb-border nb-shadow bg-card p-6">
                <span
                  className="nb-border flex size-10 items-center justify-center"
                  style={{ background: f.color }}
                >
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-black uppercase">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive demo */}
        <section className="pb-24">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
                See it in action
              </h2>
              <p className="mt-3 max-w-lg text-base text-muted-foreground">
                Watch how time travel, forking, approval gates, and team memory
                work together in a live session.
              </p>
            </div>
            <span className="nb-border hidden bg-[#2ECC71] px-3 py-1.5 text-xs font-black uppercase tracking-widest sm:inline-block">
              interactive demo
            </span>
          </div>
          <TimeTravelDemo />
        </section>

        {/* CTA */}
        <section className="pb-28">
          <div className="nb-border nb-shadow flex flex-col items-center gap-6 bg-accent px-8 py-16 text-center">
            <h2 className="max-w-xl text-4xl font-black uppercase leading-tight tracking-tight sm:text-5xl">
              Stop chatting with AI alone
            </h2>
            <p className="max-w-lg text-base font-medium text-foreground/80">
              Spin up a session in seconds. Invite your team. Bring the agent.
              Branch it when things get interesting.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                className="nb-border nb-lift h-14 px-10 text-lg font-black"
              >
                Get started
                <ArrowRight className="ml-2 size-5" />
              </Button>
              <GuidedDemo />
            </div>
          </div>
        </section>
      </main>

      <footer className="nb-border border-x-0 border-b-0 py-8 text-center text-sm font-medium text-muted-foreground">
        MULTIPLAYER — real-time collaborative workspace
      </footer>
    </div>
  );
}

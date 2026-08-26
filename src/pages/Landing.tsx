import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import TimeTravelDemo from "@/components/TimeTravelDemo";
import {
  ArrowRight,
  Bot,
  GitBranch,
  History,
  MousePointer2,
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
    body: "Every cursor and focus state is broadcast in real time. You always know who is looking at what.",
  },
  {
    icon: Bot,
    color: "#FFD400",
    title: "AI in the thread",
    body: "@mention the agent to pull it into the conversation. Every action is attributed to who prompted it.",
  },
  {
    icon: Zap,
    color: "#4DA6FF",
    title: "Interrupt anytime",
    body: "Send a message mid-turn to redirect the agent. It folds your interruption in without losing the plot.",
  },
  {
    icon: History,
    color: "#2ECC71",
    title: "Time travel",
    body: "Scrub the entire session back to any past moment. See exactly how things looked, then branch from there.",
  },
  {
    icon: GitBranch,
    color: "#B57BFF",
    title: "Fork & branch",
    body: "Create a new session from any timeline position — like branching code. Original is untouched.",
  },
  {
    icon: ShieldHalf,
    color: "#FF9440",
    title: "Compare runs",
    body: "Side-by-side synced timelines. See what if we'd redirected the agent vs. letting it continue?",
  },
];

const STEPS_DATA = [
  {
    num: "01",
    title: "Start a session",
    color: "#FF5C5C",
    body: "Give it a name, hit create. You get a shareable link and a 6-character join code.",
  },
  {
    num: "02",
    title: "Collaborate live",
    color: "#FFD400",
    body: "Team members join instantly. Everyone's cursor is visible. @mention the AI to bring it in.",
  },
  {
    num: "03",
    title: "Scrub & fork",
    color: "#4DA6FF",
    body: "Drag the timeline scrubber to any past event. Click 'Fork from here' to branch a fresh session.",
  },
  {
    num: "04",
    title: "Compare what-ifs",
    color: "#B57BFF",
    body: "Open the compare view to see original and fork side by side, timeline synced.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="nb-border sticky top-0 z-20 border-x-0 border-t-0 bg-card px-4 sm:px-6">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="nb-border nb-shadow-sm flex size-7 items-center justify-center bg-primary text-xs font-black">
              M/
            </span>
            <span className="text-sm font-black uppercase tracking-tight">
              Multiplayer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
              className="nb-border nb-lift h-9 bg-primary px-4 text-sm font-black text-black"
            >
              {isAuthenticated ? "Open app" : "Start free"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <span className="nb-border inline-block bg-accent px-2 py-1 text-[11px] font-black uppercase tracking-widest">
              Humans + AI · one live session
            </span>
            <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
              Your team + AI.
              <br />
              <span className="bg-primary px-2 box-decoration-clone">
                One shared room.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
              Multiplayer makes AI work a team sport. Create a session, share a
              link, and collaborate with live cursors, clear roles, and an agent
              that works in the open — interruptible at any moment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                className="nb-border nb-lift h-12 bg-primary px-6 text-base font-black text-black"
              >
                Create a session
                <ArrowRight className="ml-2 size-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                className="nb-border nb-lift h-12 bg-card px-6 text-base font-bold"
              >
                Join with a code
              </Button>
            </div>
          </div>

          {/* Hero mock — static session preview */}
          <div className="nb-border nb-shadow bg-card">
            <div className="nb-border flex h-10 items-center gap-2 border-x-0 border-t-0 bg-secondary px-3">
              <span className="size-2 bg-[#FF5C5C]" />
              <span className="size-2 bg-[#FFD400]" />
              <span className="size-2 bg-[#2ECC71]" />
              <span className="ml-2 text-[10px] font-black uppercase tracking-widest">
                launch-war-room · running
              </span>
            </div>
            <div className="relative space-y-3 p-4 text-sm">
              <div className="max-w-[80%]">
                <p className="text-[9px] font-black uppercase text-muted-foreground">
                  Maya
                </p>
                <div className="nb-border nb-shadow-sm w-fit bg-background px-2.5 py-1.5">
                  @agent can you check why signups dipped this week?
                </div>
              </div>
              <div className="max-w-[85%] justify-end justify-self-end text-right">
                <p className="text-[9px] font-black uppercase text-muted-foreground">
                  <span className="bg-primary px-1 py-px text-black">AGENT</span>{" "}
                  prompted by @maya
                </p>
                <div className="nb-border nb-shadow-sm ml-auto w-fit bg-primary/90 px-2.5 py-1.5 text-left">
                  On it — pulling the signup funnel now.
                </div>
              </div>
              <div className="flex justify-center">
                <div className="nb-border flex items-center gap-1.5 bg-secondary px-2.5 py-1 font-mono text-[11px]">
                  <Bot className="size-3 animate-pulse" />
                  search_knowledge_base(&quot;signup dip&quot;)
                </div>
              </div>
              <div className="flex max-w-[70%] items-start gap-1">
                <MousePointer2 className="mt-0.5 size-4 shrink-0 text-[#B57BFF]" />
                <span className="nb-border bg-[#B57BFF] px-1.5 py-0.5 text-[10px] font-bold text-black">
                  Jonas · typing
                </span>
              </div>
              <div className="flex items-center gap-1 pl-6">
                <MousePointer2 className="size-4 text-[#FF9440]" />
                <span className="nb-border bg-[#FF9440] px-1.5 py-0.5 text-[10px] font-bold text-black">
                  Priya
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works — step-by-step */}
        <section className="pb-16">
          <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
            How it works
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Four steps from zero to a full collaborative AI session with time travel.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS_DATA.map((s) => (
              <div key={s.num} className="nb-border nb-shadow bg-card p-5">
                <span
                  className="nb-border mb-3 flex h-8 w-12 items-center justify-center font-mono text-sm font-black"
                  style={{ background: s.color }}
                >
                  {s.num}
                </span>
                <h3 className="font-black uppercase">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Time Travel demo */}
        <section className="pb-20">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
                See it in action
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Watch how time travel, forking, and compare work — scrub any
                timeline, branch a fresh agent run, compare what-ifs side by side.
              </p>
            </div>
            <span className="nb-border hidden bg-[#2ECC71] px-2 py-1 text-[10px] font-black uppercase tracking-widest sm:inline">
              animated demo
            </span>
          </div>
          <TimeTravelDemo />
        </section>

        {/* Features grid */}
        <section className="pb-20">
          <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
            Built for teams moving fast
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="nb-border nb-shadow bg-card p-5">
                <span
                  className="nb-border flex size-9 items-center justify-center"
                  style={{ background: f.color }}
                >
                  <f.icon className="size-4" />
                </span>
                <h3 className="mt-3 font-black uppercase">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24">
          <div className="nb-border nb-shadow flex flex-col items-center gap-4 bg-accent px-6 py-12 text-center">
            <h2 className="max-w-xl text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              Stop chatting with AI alone
            </h2>
            <p className="max-w-md text-sm font-medium text-foreground/80">
              Spin up a session in seconds. Invite your team. Bring the agent. Branch it when things get interesting.
            </p>
            <Button
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
              className="nb-border nb-lift mt-2 h-12 bg-primary px-8 text-base font-black text-black"
            >
              Get started
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="nb-border border-x-0 border-b-0 py-6 text-center text-xs font-medium text-muted-foreground">
        MULTIPLAYER — real-time collaborative workspace
      </footer>
    </div>
  );
}

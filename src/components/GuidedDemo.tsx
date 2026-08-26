import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Clock,
  GitFork,
  MousePointer2,
  Play,
  Radio,
  Shield,
  SkipForward,
  Square,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";

type Step = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Play;
  color: string;
  durationMs: number;
};

const STEPS: Step[] = [
  {
    id: "radar",
    title: "Org-Wide Radar",
    subtitle: "See every active session across your team in real time",
    icon: Radio,
    color: "#2ECC71",
    durationMs: 6000,
  },
  {
    id: "session",
    title: "Live Collaboration",
    subtitle: "Two users + AI agent working together in real time",
    icon: Users,
    color: "#4DA6FF",
    durationMs: 8000,
  },
  {
    id: "interrupt",
    title: "Interrupt & Redirect",
    subtitle: "A human interrupts the agent mid-turn — it adapts instantly",
    icon: Zap,
    color: "#FFD400",
    durationMs: 5000,
  },
  {
    id: "memory",
    title: "Team Memory",
    subtitle: "The agent cites knowledge learned from a past session",
    icon: Bot,
    color: "#B57BFF",
    durationMs: 5000,
  },
  {
    id: "gate",
    title: "Approval Gate",
    subtitle: "Agent proposes a code change — team reviews with diff UI",
    icon: Shield,
    color: "#FF9440",
    durationMs: 6000,
  },
  {
    id: "timetravel",
    title: "Time Travel & Fork",
    subtitle: "Scrub back in time, then branch a new session from any point",
    icon: GitFork,
    color: "#FF5C5C",
    durationMs: 6000,
  },
  {
    id: "handoff",
    title: "Handoff & Away Briefing",
    subtitle: "Hand off to a teammate in another timezone — they see what happened",
    icon: Clock,
    color: "#00C2C7",
    durationMs: 5000,
  },
  {
    id: "finish",
    title: "Back to Radar",
    subtitle: "All sessions visible — the full picture of your team + AI at work",
    icon: Radio,
    color: "#2ECC71",
    durationMs: 4000,
  },
];

export default function GuidedDemo() {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cursorRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const sessions = useQuery(api.sessions.listSessions) as
    | Array<{ _id: string; title: string; state: string }> | undefined;

  const currentStep = STEPS[stepIdx];

  // Auto-advance steps.
  useEffect(() => {
    if (!active || paused || !currentStep) return;
    timerRef.current = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) {
        setStepIdx((i) => i + 1);
      } else {
        setActive(false);
        setStepIdx(0);
      }
    }, currentStep.durationMs);
    return () => clearTimeout(timerRef.current);
  }, [active, paused, stepIdx, currentStep]);

  // Simulated cursor movement during session step.
  useEffect(() => {
    if (!active) return;
    const isSessionStep =
      currentStep?.id === "session" ||
      currentStep?.id === "interrupt" ||
      currentStep?.id === "memory";
    if (isSessionStep) {
      setShowCursor(true);
      cursorRef.current = setInterval(() => {
        setCursorPos({
          x: 30 + Math.sin(Date.now() / 1000) * 20 + Math.random() * 10,
          y: 30 + Math.cos(Date.now() / 800) * 15 + Math.random() * 10,
        });
      }, 50);
    } else {
      setShowCursor(false);
    }
    return () => clearInterval(cursorRef.current);
  }, [active, currentStep]);

  const startDemo = async () => {
    // Navigate to dashboard first (seeds data if needed).
    navigate("/dashboard");
    // Wait a beat for seed to run.
    await new Promise((r) => setTimeout(r, 1500));
    setActive(true);
    setStepIdx(0);
    setPaused(false);
  };

  const skipToStep = (idx: number) => {
    setStepIdx(idx);
    setPaused(false);
  };

  const navigateToStep = (stepId: string) => {
    switch (stepId) {
      case "radar":
        navigate("/radar");
        break;
      case "session":
      case "interrupt":
      case "memory":
      case "gate": {
        // Find the billing API session (has a pending gate).
        const billingSession = sessions?.find(
          (s) => s.title.includes("Billing") || s.title.includes("Rate Limit"),
        );
        if (billingSession) navigate(`/session/${billingSession._id}`);
        else {
          const first = sessions?.[0];
          if (first) navigate(`/session/${first._id}`);
        }
        break;
      }
      case "timetravel":
      case "handoff": {
        const forkedSession = sessions?.find((s) => s.title.includes("fork"));
        if (forkedSession) navigate(`/session/${forkedSession._id}`);
        else {
          const first = sessions?.[0];
          if (first) navigate(`/session/${first._id}`);
        }
        break;
      }
      case "finish":
        navigate("/radar");
        break;
    }
  };

  // Navigate when step changes.
  useEffect(() => {
    if (active && currentStep) {
      navigateToStep(currentStep.id);
    }
  }, [stepIdx, active]);

  if (!active) {
    return (
      <Button
        onClick={startDemo}
        className="nb-border nb-lift h-12 bg-[#2ECC71] px-6 text-base font-black text-black"
      >
        <Play className="mr-2 size-4" />
        Start guided demo
      </Button>
    );
  }

  return (
    <>
      {/* Simulated cursor */}
      {showCursor && (
        <div
          className="pointer-events-none fixed z-[9999] transition-all duration-75 ease-out"
          style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#FF5C5C"
            stroke="#111"
            strokeWidth="1.5"
          >
            <path d="M4 2 L20 12 L12 13 L9 21 Z" />
          </svg>
          <span
            className="nb-border absolute top-4 left-4 whitespace-nowrap bg-[#FF5C5C] px-1.5 py-0.5 text-[10px] font-bold text-black"
          >
            Demo cursor
          </span>
        </div>
      )}

      {/* Demo overlay bar */}
      <div className="nb-border fixed bottom-0 left-0 right-0 z-[9998] flex items-center gap-3 border-x-0 border-b-0 bg-card px-4 py-3 sm:px-6">
        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => skipToStep(i)}
              className={`nb-border size-3 transition-colors ${
                i === stepIdx
                  ? "scale-125"
                  : i < stepIdx
                    ? "opacity-50"
                    : "opacity-30"
              }`}
              style={{ background: i <= stepIdx ? s.color : "transparent" }}
              title={s.title}
            />
          ))}
        </div>

        {/* Current step info */}
        {currentStep && (
          <div className="flex items-center gap-2">
            <currentStep.icon
              className="size-4 shrink-0"
              style={{ color: currentStep.color }}
            />
            <div>
              <p className="text-xs font-black uppercase">{currentStep.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {currentStep.subtitle}
              </p>
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setPaused(!paused)}
            className="nb-border h-7 bg-secondary px-2 text-[10px] font-bold"
          >
            {paused ? (
              <>
                <Play className="size-3" /> Resume
              </>
            ) : (
              <>
                <Square className="size-3" /> Pause
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (stepIdx < STEPS.length - 1) {
                setStepIdx((i) => i + 1);
              } else {
                setActive(false);
                setStepIdx(0);
              }
            }}
            className="nb-border h-7 bg-primary px-2 text-[10px] font-black text-black"
          >
            <SkipForward className="size-3" /> Next
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setActive(false);
              setStepIdx(0);
              setShowCursor(false);
            }}
            variant="outline"
            className="nb-border h-7 bg-card px-2 text-[10px] font-bold"
          >
            End demo
          </Button>
        </div>
      </div>
    </>
  );
}

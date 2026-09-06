import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Eye,
  GitBranch,
  Info,
  Radio,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-foreground hover:text-background">
          <Info className="size-2.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-60 border-2 border-foreground bg-card text-card-foreground"
      >
        <p className="text-[11px] leading-snug">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const ROLE_INFO = [
  {
    value: "driver",
    label: "Driver",
    icon: Shield,
    color: "bg-[#FFD400]",
    description: "Full control — manages the session, approves members, directs the AI agent.",
  },
  {
    value: "copilot",
    label: "Co-pilot",
    icon: GitBranch,
    color: "bg-[#4DA6FF]",
    description: "Collaborate — sends messages, prompts AI, can pause/resume the session.",
  },
  {
    value: "observer",
    label: "Observer",
    icon: Eye,
    color: "bg-[#E5E5DF]",
    description: "Read-only — watches the conversation and AI activity in real time.",
  },
] as const;

export default function RoleSelection({
  sessionId,
  sessionTitle,
  onBack,
}: {
  sessionId: string;
  sessionTitle: string;
  onBack: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const joinSession = useMutation(api.sessions.joinSession);

  const handleJoin = async () => {
    setSubmitting(true);
    try {
      await joinSession({
        sessionId: sessionId as never,
        role: "observer", // default hint; driver will assign the actual role
      });
      toast.success("Request sent — waiting for the driver to approve.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </button>

        {/* Header */}
        <div className="nb-border nb-shadow bg-card p-6 text-center">
          <div className="nb-border mx-auto mb-3 flex size-10 items-center justify-center bg-primary">
            <Radio className="size-5 text-black" />
          </div>
          <h1 className="text-lg font-black uppercase tracking-tight">
            Join Session
          </h1>
          <p className="mt-0.5 text-sm font-bold text-muted-foreground">
            {sessionTitle}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Request to join and the driver will assign your role.
          </p>
        </div>

        {/* Role reference cards — informational only */}
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Roles explained
            <InfoTip text="The driver decides what role to assign you when they accept your request. Here's what each role means." />
          </p>
          {ROLE_INFO.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.value}
                className="nb-border flex items-center gap-3 bg-card px-4 py-3"
              >
                <span
                  className={`nb-border flex size-8 shrink-0 items-center justify-center ${role.color}`}
                >
                  <Icon className="size-4 text-black" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase">{role.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {role.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Join button */}
        <Button
          onClick={handleJoin}
          disabled={submitting}
          className="nb-border nb-lift mt-4 h-11 w-full bg-primary text-sm font-black text-black"
        >
          <Radio className="size-4" />
          {submitting ? "Sending request..." : "Request to join"}
        </Button>
      </div>
    </div>
  );
}

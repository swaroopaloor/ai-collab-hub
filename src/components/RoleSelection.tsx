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
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";

type RoleChoice = "driver" | "copilot" | "observer";

const ROLES: Array<{
  value: RoleChoice;
  label: string;
  icon: typeof Shield;
  color: string;
  description: string;
  details: string[];
}> = [
  {
    value: "driver",
    label: "Driver",
    icon: Shield,
    color: "bg-[#FFD400]",
    description: "Full control of the session",
    details: [
      "Send messages and prompt the AI",
      "Pause, resume, or end the session",
      "Hand off control to other participants",
      "Approve or deny new members joining",
      "Fork the session timeline",
      "Set autonomous mode for the AI agent",
    ],
  },
  {
    value: "copilot",
    label: "Co-pilot",
    icon: GitBranch,
    color: "bg-[#4DA6FF]",
    description: "Collaborate alongside the driver",
    details: [
      "Send messages and prompt the AI",
      "Pause, resume, or end the session",
      "View all session activity in real time",
      "Can request driver control at any time",
      "Cannot hand off or approve new members",
    ],
  },
  {
    value: "observer",
    label: "Observer",
    icon: Eye,
    color: "bg-[#E5E5DF]",
    description: "Read-only view of the session",
    details: [
      "Watch the conversation in real time",
      "See AI activity and tool usage",
      "Cannot send messages or prompt the AI",
      "Can request control to become a co-pilot or driver",
      "Great for reviewing and auditing",
    ],
  },
];

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

export default function RoleSelection({
  sessionId,
  sessionTitle,
  onBack,
}: {
  sessionId: string;
  sessionTitle: string;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<RoleChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const joinSession = useMutation(api.sessions.joinSession);

  const handleJoin = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await joinSession({
        sessionId: sessionId as never,
        role: selected,
      });
      toast.success(
        selected === "driver"
          ? "Welcome, driver! You're in."
          : "Request sent — waiting for the driver to approve.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
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
            Choose your role to join this session. The driver will review and
            approve your request.
          </p>
        </div>

        {/* Role cards */}
        <div className="mt-4 space-y-3">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selected === role.value;
            return (
              <button
                key={role.value}
                onClick={() => setSelected(role.value)}
                className={`nb-border nb-lift w-full text-left transition-all ${
                  isSelected
                    ? "nb-shadow bg-card ring-2 ring-foreground"
                    : "bg-card hover:bg-secondary"
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={`nb-border mt-0.5 flex size-8 shrink-0 items-center justify-center ${role.color}`}
                  >
                    <Icon className="size-4 text-black" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black uppercase">
                        {role.label}
                      </p>
                      <InfoTip
                        text={
                          role.value === "driver"
                            ? "Drivers have full control — they manage participants, approve joins, and direct the AI agent."
                            : role.value === "copilot"
                              ? "Co-pilots collaborate with the driver — they can send messages and prompt the AI but can't manage the session."
                              : "Observers have a read-only view — perfect for reviewing activity without participating."
                        }
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {role.description}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {role.details.map((d) => (
                        <li
                          key={d}
                          className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                        >
                          <span className="mt-0.5 size-1 shrink-0 rounded-full bg-foreground" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {isSelected && (
                    <span className="nb-border flex size-6 shrink-0 items-center justify-center bg-primary text-xs font-black text-black">
                      ✓
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Join button */}
        <Button
          onClick={handleJoin}
          disabled={!selected || submitting}
          className="nb-border nb-lift mt-4 h-11 w-full bg-primary text-sm font-black text-black"
        >
          <Zap className="size-4" />
          {submitting
            ? "Sending..."
            : selected
              ? `Request to join as ${selected}`
              : "Select a role to continue"}
        </Button>
      </div>
    </div>
  );
}

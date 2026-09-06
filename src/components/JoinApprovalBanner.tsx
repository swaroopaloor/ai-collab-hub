import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Info, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type JoinRequest = {
  _id: string;
  sessionId: string;
  userId: string;
  requestedRole: string;
  name: string;
  status: string;
  createdAt: number;
};

export default function JoinApprovalBanner({
  sessionId,
}: {
  sessionId: string;
}) {
  const requests = useQuery(
    api.sessions.pendingJoinRequests,
    sessionId ? { sessionId: sessionId as never } : "skip",
  ) as JoinRequest[] | undefined;

  const decideWithRole = useMutation(api.sessions.decideJoinRequestWithRole);

  const handleDecision = async (
    requestId: string,
    decision: "approved" | "denied",
    assignedRole: "driver" | "copilot" | "observer",
  ) => {
    try {
      await decideWithRole({
        requestId: requestId as never,
        decision,
        assignedRole,
      });
      toast.success(
        decision === "approved"
          ? `Member approved as ${assignedRole}`
          : "Join request denied",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (!requests || requests.length === 0) return null;

  return (
    <div className="nb-border mx-2 mb-2 bg-[#FFD400] px-3 py-3 sm:mx-4 md:mx-8">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 shrink-0 text-black" />
        <p className="text-xs font-black uppercase tracking-wide text-black">
          Join request{requests.length !== 1 ? "s" : ""}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full bg-black/10 text-black transition-colors hover:bg-black/20">
              <Info className="size-2.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-56 border-2 border-foreground bg-card text-card-foreground"
          >
            <p className="text-[11px] leading-snug">
              Review each request and assign a role. Choose Driver for full
              control, Co-pilot to collaborate, or Observer for read-only
              access.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 space-y-2">
        {requests.map((req) => (
          <JoinRequestRow
            key={req._id}
            req={req}
            onDecide={handleDecision}
          />
        ))}
      </div>
    </div>
  );
}

function JoinRequestRow({
  req,
  onDecide,
}: {
  req: JoinRequest;
  onDecide: (
    requestId: string,
    decision: "approved" | "denied",
    assignedRole: "driver" | "copilot" | "observer",
  ) => void;
}) {
  const [role, setRole] = useState<"driver" | "copilot" | "observer">(
    req.requestedRole as "driver" | "copilot" | "observer",
  );
  const [decided, setDecided] = useState(false);

  const handleApprove = () => {
    setDecided(true);
    onDecide(req._id, "approved", role);
  };

  const handleDeny = () => {
    setDecided(true);
    onDecide(req._id, "denied", role);
  };

  if (decided) return null;

  return (
    <div className="nb-border flex flex-col gap-2 bg-card px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{req.name}</p>
        <p className="text-[10px] text-muted-foreground">
          Wants to join the session
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          Role:
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="nb-border cursor-pointer bg-secondary px-2 py-1 text-[10px] font-bold text-foreground"
          aria-label="Assign role"
        >
          <option value="driver">Driver</option>
          <option value="copilot">Co-pilot</option>
          <option value="observer">Observer</option>
        </select>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          size="sm"
          onClick={handleApprove}
          className="nb-border nb-lift h-7 bg-[#2ECC71] px-2.5 text-[10px] font-black text-black"
        >
          <Check className="size-3" />
          Approve
        </Button>
        <Button
          size="sm"
          onClick={handleDeny}
          className="nb-border nb-lift h-7 bg-[#FF5C5C] px-2.5 text-[10px] font-black text-white"
        >
          <X className="size-3" />
          Deny
        </Button>
      </div>
    </div>
  );
}

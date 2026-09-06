import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Info, UserPlus, X } from "lucide-react";
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

  const decideRequest = useMutation(api.sessions.decideJoinRequest);

  const handleDecision = async (
    requestId: string,
    decision: "approved" | "denied",
  ) => {
    try {
      await decideRequest({
        requestId: requestId as never,
        decision,
      });
      toast.success(
        decision === "approved"
          ? "Member approved and added to session"
          : "Join request denied",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (!requests || requests.length === 0) return null;

  return (
    <div className="nb-border mx-4 mb-2 bg-[#FFD400] px-4 py-3 sm:mx-8">
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
              New users must be approved before they can join. Choose their
              role: Driver (full control), Co-pilot (collaborate), or Observer
              (read-only).
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-2 space-y-2">
        {requests.map((req) => (
          <div
            key={req._id}
            className="nb-border flex items-center gap-3 bg-card px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{req.name}</p>
              <p className="text-[10px] text-muted-foreground">
                Requesting to join as{" "}
                <span className="font-bold uppercase">{req.requestedRole}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                onClick={() => handleDecision(req._id, "approved")}
                className="nb-border nb-lift h-7 bg-[#2ECC71] px-2.5 text-[10px] font-black text-black"
              >
                <Check className="size-3" />
                Approve
              </Button>
              <Button
                size="sm"
                onClick={() => handleDecision(req._id, "denied")}
                className="nb-border nb-lift h-7 bg-[#FF5C5C] px-2.5 text-[10px] font-black text-white"
              >
                <X className="size-3" />
                Deny
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

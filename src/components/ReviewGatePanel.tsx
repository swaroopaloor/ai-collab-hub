import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import DiffRenderer from "@/components/DiffRenderer";
import {
  Check,
  CheckCircle,
  Edit3,
  MessageSquare,
  Shield,
  ShieldOff,
  X,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type Gate = {
  _id: string;
  sessionId: string;
  status: "pending" | "approved" | "rejected" | "edited";
  artifactType: string;
  title: string;
  beforeContent: string;
  afterContent: string;
  editedContent?: string;
  comment?: string;
  createdBy: string;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
};

export default function ReviewGatePanel({ sessionId }: { sessionId: string }) {
  const gates = useQuery(
    api.gates.listGates,
    sessionId ? { sessionId: sessionId as never } : "skip",
  ) as Gate[] | undefined;

  const pending = gates?.filter((g) => g.status === "pending") ?? [];
  const resolved = gates?.filter((g) => g.status !== "pending") ?? [];

  if (!gates) return null;
  if (gates.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Pending gates */}
      {pending.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#FFD400]">
            <Shield className="size-3.5" />
            Awaiting review · {pending.length}
          </p>
          {pending.map((gate) => (
            <PendingGate key={gate._id} gate={gate} />
          ))}
        </div>
      )}

      {/* Resolved gates */}
      {resolved.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <CheckCircle className="size-3.5" />
            Reviewed · {resolved.length}
          </p>
          {resolved.map((gate) => (
            <ResolvedGate key={gate._id} gate={gate} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingGate({ gate }: { gate: Gate }) {
  const approveGate = useMutation(api.gates.approveGate);
  const rejectGate = useMutation(api.gates.rejectGate);
  const [showDiff, setShowDiff] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(gate.afterContent);
  const [acting, setActing] = useState(false);

  const handleApprove = async (edited?: string) => {
    setActing(true);
    try {
      await approveGate({
        gateId: gate._id as never,
        editedContent: edited || undefined,
      });
      toast.success("Change approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) return;
    setActing(true);
    try {
      await rejectGate({
        gateId: gate._id as never,
        comment: rejectComment,
      });
      toast.success("Change rejected — agent notified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="nb-border nb-shadow mb-3 bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-black uppercase">{gate.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Proposed by {gate.createdBy} ·{" "}
            {new Date(gate.createdAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className="nb-border flex shrink-0 items-center gap-1 bg-[#FFD400] px-2 py-0.5 text-[9px] font-black text-black">
          <Shield className="size-2.5" />
          PENDING
        </span>
      </div>

      {/* Diff toggle */}
      <button
        onClick={() => setShowDiff(!showDiff)}
        className="nb-border mt-3 w-full bg-secondary px-3 py-1.5 text-left text-[11px] font-bold hover:bg-card"
      >
        {showDiff ? "Hide diff" : "Show proposed change"}
      </button>

      {showDiff && (
        <div className="mt-2 max-h-64 overflow-auto">
          {editing ? (
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#4DA6FF]">
                Edit before approving
              </p>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="nb-border h-32 w-full bg-background p-2 font-mono text-[11px] outline-none"
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    handleApprove(editedContent);
                    setEditing(false);
                  }}
                  disabled={acting}
                  className="nb-border nb-lift bg-[#2ECC71] px-3 text-[10px] font-black text-black"
                >
                  <Check className="size-3" /> Approve edited
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setEditedContent(gate.afterContent);
                  }}
                  className="nb-border bg-card px-3 text-[10px] font-bold"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <DiffRenderer
              before={gate.beforeContent}
              after={gate.afterContent}
              artifactType={gate.artifactType}
            />
          )}
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => handleApprove()}
            disabled={acting}
            className="nb-border nb-lift bg-[#2ECC71] px-3 text-[10px] font-black text-black"
          >
            <Check className="size-3" /> Approve
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(true);
              setEditedContent(gate.afterContent);
            }}
            disabled={acting}
            className="nb-border nb-lift bg-[#4DA6FF] px-3 text-[10px] font-black text-black"
          >
            <Edit3 className="size-3" /> Edit & approve
          </Button>
          <Button
            size="sm"
            onClick={() => setShowReject(!showReject)}
            disabled={acting}
            variant="outline"
            className="nb-border bg-card px-3 text-[10px] font-bold"
          >
            <X className="size-3" /> Reject
          </Button>
        </div>
      )}

      {/* Reject form */}
      {showReject && !editing && (
        <div className="mt-2">
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Why is this change being rejected?"
            className="nb-border h-16 w-full bg-background p-2 text-[11px] outline-none placeholder:text-muted-foreground"
          />
          <Button
            size="sm"
            onClick={handleReject}
            disabled={!rejectComment.trim() || acting}
            className="nb-border nb-lift mt-1 bg-[#FF5C5C] px-3 text-[10px] font-black text-black"
          >
            <ShieldOff className="size-3" /> Reject with comment
          </Button>
        </div>
      )}
    </div>
  );
}

function ResolvedGate({ gate }: { gate: Gate }) {
  const [showDiff, setShowDiff] = useState(false);

  const statusConfig = {
    approved: { label: "APPROVED", color: "bg-[#2ECC71]", icon: Check },
    edited: { label: "EDITED & APPROVED", color: "bg-[#4DA6FF]", icon: Edit3 },
    rejected: { label: "REJECTED", color: "bg-[#FF5C5C]", icon: X },
  };

  const cfg = statusConfig[gate.status as keyof typeof statusConfig] ?? statusConfig.approved;
  const StatusIcon = cfg.icon;

  return (
    <div className="nb-border mb-2 bg-background p-3 opacity-75">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className="size-3" />
          <span className="text-[11px] font-bold">{gate.title}</span>
        </div>
        <span
          className={`nb-border px-1.5 py-0.5 text-[9px] font-black ${cfg.color} ${gate.status === "rejected" ? "text-white" : "text-black"}`}
        >
          {cfg.label}
        </span>
      </div>
      {gate.decidedBy && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {gate.decidedBy} ·{" "}
          {gate.decidedAt
            ? new Date(gate.decidedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })
            : ""}
        </p>
      )}
      {gate.comment && (
        <p className="mt-1 flex items-start gap-1 text-[11px]">
          <MessageSquare className="mt-0.5 size-3 shrink-0 text-[#FF5C5C]" />
          {gate.comment}
        </p>
      )}
      {gate.editedContent && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Content was edited before approval
        </p>
      )}
      <button
        onClick={() => setShowDiff(!showDiff)}
        className="mt-1 text-[10px] font-bold underline decoration-2"
      >
        {showDiff ? "Hide" : "Show"} diff
      </button>
      {showDiff && (
        <div className="mt-2 max-h-40 overflow-auto">
          <DiffRenderer
            before={gate.beforeContent}
            after={gate.editedContent ?? gate.afterContent}
            artifactType={gate.artifactType}
          />
        </div>
      )}
    </div>
  );
}

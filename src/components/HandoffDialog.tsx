import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { GitBranch, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type Participant = {
  _id: string;
  userId: string;
  role: string;
  name: string;
};

export default function HandoffDialog({
  sessionId,
  participants,
}: {
  sessionId: string;
  participants: Participant[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

  const handoffSession = useMutation(api.sessions.handoffSession);

  const handleHandoff = async () => {
    if (!selectedUserId || !note.trim()) return;
    setActing(true);
    try {
      await handoffSession({
        sessionId: sessionId as never,
        toUserId: selectedUserId as never,
        note: note.trim(),
      });
      toast.success("Session handed off");
      setOpen(false);
      setNote("");
      setSelectedUserId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      setActing(false);
    }
  };

  if (!open) {
    return (
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="nb-border nb-lift h-8 bg-[#B57BFF] px-2.5 text-[10px] font-black text-black sm:text-xs"
      >
        <GitBranch className="size-3.5" />
        Hand off
      </Button>
    );
  }

  return (
    <div className="nb-border nb-shadow absolute right-0 top-full z-50 mt-2 w-72 bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-black uppercase">
          <GitBranch className="size-3.5" />
          Hand off session
        </p>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground">
        Hand this session to a teammate. They'll become the driver.
      </p>

      {/* Participant picker */}
      <div className="mt-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Hand off to
        </p>
        <div className="max-h-28 space-y-1 overflow-y-auto">
          {participants.map((p) => (
            <button
              key={p.userId}
              onClick={() => setSelectedUserId(p.userId)}
              className={`nb-border flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-bold ${
                selectedUserId === p.userId
                  ? "bg-primary text-black"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <UserPlus className="size-3" />
              {p.name}
              <span className="ml-auto text-[9px] text-muted-foreground">
                {p.role}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="mt-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Handoff note
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Picking up where I left off — ..."
          className="nb-border h-16 w-full bg-background p-2 text-[11px] outline-none placeholder:text-muted-foreground"
        />
      </div>

      <Button
        size="sm"
        onClick={handleHandoff}
        disabled={!selectedUserId || !note.trim() || acting}
        className="nb-border nb-lift mt-2 w-full bg-[#B57BFF] px-3 text-[10px] font-black text-black"
      >
        <Send className="size-3" />
        Hand off
      </Button>
    </div>
  );
}

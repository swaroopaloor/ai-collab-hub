import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { GitBranch, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
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

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="nb-border nb-lift h-8 bg-[#B57BFF] px-2.5 text-[10px] font-black text-black sm:text-xs"
      >
        <GitBranch className="size-3.5" />
        <span className="hidden sm:inline">Hand off</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="nb-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="size-4" />
              Hand off session
            </DialogTitle>
            <DialogDescription>
              Transfer driver control to a teammate. They'll become the driver and you'll be downgraded to co-pilot.
            </DialogDescription>
          </DialogHeader>

          {/* Participant picker */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Hand off to
            </p>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {participants
                .filter((p) => p.userId !== sessionId) // exclude self implicitly by not filtering — all participants are eligible
                .map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => setSelectedUserId(p.userId)}
                    className={`nb-border flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold transition-colors ${
                      selectedUserId === p.userId
                        ? "bg-primary text-black"
                        : "bg-background hover:bg-secondary"
                    }`}
                  >
                    <UserPlus className="size-3.5 shrink-0" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] uppercase">
                      {p.role}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Handoff note
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Picking up where I left off — here's what I was working on..."
              className="nb-border h-20 w-full resize-none bg-background p-2.5 text-[11px] outline-none placeholder:text-muted-foreground"
            />
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={handleHandoff}
              disabled={!selectedUserId || !note.trim() || acting}
              className="nb-border nb-lift bg-[#B57BFF] px-4 text-[10px] font-black text-black"
            >
              <Send className="size-3" />
              {acting ? "Handing off..." : "Hand off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

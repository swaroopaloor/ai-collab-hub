import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { AlertTriangle, Bot, Clock, GitFork, Shield, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type Briefing = {
  eventCount: number;
  summary: string;
  hasPendingProposals: boolean;
} | null;

const STORAGE_KEY_PREFIX = "mp_lastSeen_";

export function getLastSeen(sessionId: string): number {
  try {
    const val = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function setLastSeen(sessionId: string) {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${sessionId}`,
      Date.now().toString(),
    );
  } catch {
    // ignore
  }
}

export default function AwayBriefing({ sessionId }: { sessionId: string }) {
  const [dismissed, setDismissed] = useState(false);
  const lastSeen = getLastSeen(sessionId);

  const briefing = useQuery(
    api.sessions.getAwayBriefing,
    sessionId && lastSeen > 0
      ? { sessionId: sessionId as never, lastSeenAt: lastSeen }
      : "skip",
  ) as Briefing;

  // Update lastSeen now that we've loaded the session.
  useEffect(() => {
    if (sessionId) setLastSeen(sessionId);
  }, [sessionId]);

  if (dismissed || !briefing || briefing.eventCount === 0) return null;

  return (
    <div className="nb-border nb-shadow mx-4 mb-3 bg-accent p-4 sm:mx-8">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="nb-border flex size-6 items-center justify-center bg-[#FFD400] text-[10px] font-black text-black">
            <Clock className="size-3.5" />
          </span>
          <h3 className="text-sm font-black uppercase">While you were away</h3>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{briefing.summary}</p>
      <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="size-2.5" />
          {briefing.eventCount} new event{briefing.eventCount !== 1 ? "s" : ""}
        </span>
        {briefing.hasPendingProposals && (
          <span className="flex items-center gap-1 text-[#FFD400]">
            <Shield className="size-2.5" />
            Pending review
          </span>
        )}
      </div>
    </div>
  );
}

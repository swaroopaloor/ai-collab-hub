import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { Radio, Users } from "lucide-react";

type PresenceEntry = {
  userId: string;
  name: string;
  sessionId: string;
  sessionTitle: string;
  color: string;
  focus: string | null;
};

const AVATAR_COLORS = ["#FF5C5C", "#4DA6FF", "#2ECC71", "#B57BFF", "#FF9440", "#00C2C7"];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function AppPresenceBar() {
  const presence = useQuery(api.radar.allPresence) as PresenceEntry[] | undefined;

  if (!presence || presence.length === 0) return null;

  return (
    <div className="nb-border flex shrink-0 items-center gap-3 overflow-x-auto border-x-0 border-t-0 bg-card px-4 py-1.5">
      <span className="nb-border flex shrink-0 items-center gap-1 bg-secondary px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
        <Radio className="size-3 text-[#2ECC71]" />
        {presence.length} online
      </span>
      <div className="flex items-center gap-2">
        {presence.map((p) => (
          <Link
            key={p.userId}
            to={`/session/${p.sessionId}`}
            className="nb-border nb-lift flex shrink-0 items-center gap-1.5 bg-background px-2 py-1 transition-colors hover:bg-secondary"
          >
            <span
              className="nb-border flex size-5 shrink-0 items-center justify-center text-[9px] font-black text-black"
              style={{ background: p.color || avatarColor(p.userId) }}
            >
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-[11px] font-bold">{p.name}</span>
            <span className="max-w-[100px] truncate text-[9px] text-muted-foreground">
              in {p.sessionTitle}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

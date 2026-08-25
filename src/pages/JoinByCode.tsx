import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";

export default function JoinByCode() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const session = useQuery(
    api.sessions.getSessionByCode,
    code ? { joinCode: code } : "skip",
  );

  useEffect(() => {
    if (session) navigate(`/session/${session._id}`, { replace: true });
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="nb-border nb-shadow bg-card px-6 py-4 text-center">
        <p className="font-black uppercase">
          Joining session <span className="bg-primary px-1">{code}</span>
        </p>
        {!session && (
          <p className="mt-1 animate-pulse text-xs text-muted-foreground">
            Looking up code...
          </p>
        )}
      </div>
      <Button
        onClick={() => navigate("/dashboard")}
        className="nb-border nb-lift bg-primary font-bold text-black"
      >
        Back to sessions
      </Button>
    </div>
  );
}

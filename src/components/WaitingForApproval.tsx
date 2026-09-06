import { Button } from "@/components/ui/button";
import { LoaderCircle, Radio, XCircle } from "lucide-react";
import { useNavigate } from "react-router";

export default function WaitingForApproval({
  sessionTitle,
  requestedRole,
}: {
  sessionTitle: string;
  requestedRole: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center">
        <div className="nb-border nb-shadow bg-card p-8">
          <div className="nb-border mx-auto mb-4 flex size-12 items-center justify-center bg-secondary">
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight">
            Waiting for approval
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You requested to join as{" "}
            <span className="font-bold text-foreground">{requestedRole}</span>.
            The session driver needs to approve your request.
          </p>
          <div className="nb-border mt-4 flex items-center justify-center gap-2 bg-secondary px-3 py-2">
            <Radio className="size-3.5 animate-pulse text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground">
              {sessionTitle}
            </span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This page updates automatically — no need to refresh.
          </p>
        </div>
        <Button
          onClick={() => navigate("/dashboard")}
          variant="outline"
          className="nb-border mt-4 bg-card text-xs font-bold"
        >
          <XCircle className="size-3.5" />
          Cancel and go back
        </Button>
      </div>
    </div>
  );
}

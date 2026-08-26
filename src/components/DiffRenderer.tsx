import { useMemo, useState } from "react";

type DiffLine = {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNum?: number;
};

/** Simple LCS-based line diff. Returns two aligned arrays. */
function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple LCS
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "unchanged", content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", content: newLines[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", content: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

/** Side-by-side diff view */
function SideBySideDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = useMemo(() => computeLineDiff(oldText, newText), [oldText, newText]);

  // Split into left/right columns
  const left: Array<{ content: string; type: string }> = [];
  const right: Array<{ content: string; type: string }> = [];

  for (const line of diff) {
    if (line.type === "unchanged") {
      left.push({ content: line.content, type: "unchanged" });
      right.push({ content: line.content, type: "unchanged" });
    } else if (line.type === "removed") {
      left.push({ content: line.content, type: "removed" });
      right.push({ content: "", type: "empty" });
    } else {
      left.push({ content: "", type: "empty" });
      right.push({ content: line.content, type: "added" });
    }
  }

  const lineClass = (type: string) => {
    switch (type) {
      case "added":
        return "bg-[#2ECC71]/15 border-l-2 border-[#2ECC71]";
      case "removed":
        return "bg-[#FF5C5C]/15 border-l-2 border-[#FF5C5C]";
      default:
        return "border-l-2 border-transparent";
    }
  };

  return (
    <div className="flex overflow-hidden border-2 border-foreground">
      {/* Left (before) */}
      <div className="flex-1 overflow-x-auto border-r border-foreground">
        <div className="bg-[#FF5C5C]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#FF5C5C]">
          Before
        </div>
        <div className="font-mono text-[11px] leading-5">
          {left.map((line, i) => (
            <div key={i} className={`px-2 ${lineClass(line.type)}`}>
              <span className="mr-2 inline-block w-6 text-right text-muted-foreground/50">
                {line.type !== "empty" ? (i + 1) : ""}
              </span>
              {line.content}
            </div>
          ))}
        </div>
      </div>
      {/* Right (after) */}
      <div className="flex-1 overflow-x-auto">
        <div className="bg-[#2ECC71]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#2ECC71]">
          After
        </div>
        <div className="font-mono text-[11px] leading-5">
          {right.map((line, i) => (
            <div key={i} className={`px-2 ${lineClass(line.type)}`}>
              <span className="mr-2 inline-block w-6 text-right text-muted-foreground/50">
                {line.type !== "empty" ? (i + 1) : ""}
              </span>
              {line.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Inline unified diff view */
function InlineDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = useMemo(() => computeLineDiff(oldText, newText), [oldText, newText]);

  const lineClass = (type: string) => {
    switch (type) {
      case "added":
        return "bg-[#2ECC71]/15 border-l-2 border-[#2ECC71]";
      case "removed":
        return "bg-[#FF5C5C]/15 border-l-2 border-[#FF5C5C]";
      default:
        return "border-l-2 border-transparent";
    }
  };

  const prefix = (type: string) => {
    switch (type) {
      case "added":
        return "+";
      case "removed":
        return "-";
      default:
        return " ";
    }
  };

  return (
    <div className="overflow-x-auto border-2 border-foreground">
      <div className="bg-secondary px-3 py-1 text-[10px] font-black uppercase tracking-widest">
        Inline diff
      </div>
      <div className="font-mono text-[11px] leading-5">
        {diff.map((line, i) => (
          <div key={i} className={`px-2 ${lineClass(line.type)}`}>
            <span className="mr-1 text-muted-foreground/50">{prefix(line.type)}</span>
            {line.content}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Structured data: before/after comparison for JSON fields */
function StructuredDiff({ oldText, newText }: { oldText: string; newText: string }) {
  let oldObj: Record<string, unknown>;
  let newObj: Record<string, unknown>;
  try {
    oldObj = JSON.parse(oldText);
    newObj = JSON.parse(newText);
  } catch {
    // Fall back to side-by-side if not valid JSON
    return <SideBySideDiff oldText={oldText} newText={newText} />;
  }

  const allKeys = [...new Set([...Object.keys(oldObj), ...Object.keys(newObj)])];

  return (
    <div className="overflow-x-auto border-2 border-foreground">
      <div className="bg-secondary px-3 py-1 text-[10px] font-black uppercase tracking-widest">
        Before / After
      </div>
      <div className="divide-y divide-foreground/10">
        {allKeys.map((key) => {
          const oldVal = JSON.stringify(oldObj[key], null, 2) ?? "—";
          const newVal = JSON.stringify(newObj[key], null, 2) ?? "—";
          const changed = oldVal !== newVal;
          return (
            <div key={key} className={`px-3 py-2 ${changed ? "bg-[#FFD400]/10" : ""}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {key}
              </p>
              {changed ? (
                <div className="mt-1 flex gap-2 font-mono text-[11px]">
                  <div className="flex-1 rounded border border-[#FF5C5C]/30 bg-[#FF5C5C]/5 px-2 py-1">
                    <span className="text-[9px] font-bold text-[#FF5C5C]">BEFORE</span>
                    <pre className="mt-0.5 whitespace-pre-wrap">{oldVal}</pre>
                  </div>
                  <div className="flex-1 rounded border border-[#2ECC71]/30 bg-[#2ECC71]/5 px-2 py-1">
                    <span className="text-[9px] font-bold text-[#2ECC71]">AFTER</span>
                    <pre className="mt-0.5 whitespace-pre-wrap">{newVal}</pre>
                  </div>
                </div>
              ) : (
                <pre className="mt-0.5 font-mono text-[11px] text-muted-foreground">{oldVal}</pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DiffRenderer({
  before,
  after,
  artifactType,
}: {
  before: string;
  after: string;
  artifactType: string;
}) {
  const [mode, setMode] = useState<"side-by-side" | "inline">("side-by-side");

  // For structured data, always use structured diff
  if (artifactType === "structured") {
    return <StructuredDiff oldText={before} newText={after} />;
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="nb-border bg-secondary px-2 py-0.5 text-[9px] font-black uppercase">
          {artifactType}
        </span>
        <button
          onClick={() => setMode("side-by-side")}
          className={`text-[10px] font-bold ${mode === "side-by-side" ? "underline decoration-2" : "text-muted-foreground"}`}
        >
          Side-by-side
        </button>
        <button
          onClick={() => setMode("inline")}
          className={`text-[10px] font-bold ${mode === "inline" ? "underline decoration-2" : "text-muted-foreground"}`}
        >
          Inline
        </button>
      </div>
      {mode === "side-by-side" ? (
        <SideBySideDiff oldText={before} newText={after} />
      ) : (
        <InlineDiff oldText={before} newText={after} />
      )}
    </div>
  );
}

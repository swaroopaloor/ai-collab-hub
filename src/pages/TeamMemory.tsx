import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft,
  Brain,
  Edit3,
  Link2,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type MemoryEntry = {
  _id: string;
  content: string;
  sourceSessionId: string;
  sourceSessionTitle: string;
  tags: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export default function TeamMemory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");

  const memories = useQuery(
    api.memory.listMemory,
    filterTag ? { tag: filterTag } : {},
  ) as MemoryEntry[] | undefined;

  const searchResults = useQuery(
    api.memory.searchMemory,
    search ? { query: search } : "skip",
  ) as MemoryEntry[] | undefined;

  const updateMemory = useMutation(api.memory.updateMemory);
  const deleteMemory = useMutation(api.memory.deleteMemory);

  const displayMemories = search ? searchResults : memories;

  // Collect all unique tags for the tag cloud
  const allTags = [...new Set((memories ?? []).flatMap((m) => m.tags))].sort();

  const startEdit = (m: MemoryEntry) => {
    setEditingId(m._id);
    setEditContent(m.content);
    setEditTags(m.tags.join(", "));
  };

  const saveEdit = async (memoryId: string) => {
    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateMemory({
        memoryId: memoryId as never,
        content: editContent,
        tags,
      });
      toast.success("Memory updated");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (memoryId: string) => {
    try {
      await deleteMemory({ memoryId: memoryId as never });
      toast.success("Memory deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="nb-border flex h-14 shrink-0 items-center gap-3 border-x-0 border-t-0 bg-card px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="nb-border h-8 bg-card px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="nb-border flex size-7 items-center justify-center bg-[#B57BFF] text-xs font-black text-black">
            <Brain className="size-4" />
          </span>
          <h1 className="text-sm font-black uppercase tracking-tight sm:text-base">
            Team Memory
          </h1>
        </div>
        <span className="nb-border hidden bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-widest sm:inline">
          shared knowledge
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Tag sidebar */}
        <aside className="nb-border hidden w-56 shrink-0 flex-col overflow-y-auto border-r-0 border-t-0 bg-card md:flex">
          <p className="border-b-2 border-foreground px-4 py-2.5 text-[10px] font-black uppercase tracking-widest">
            Tags · {allTags.length}
          </p>
          <div className="flex-1 overflow-y-auto p-3">
            <button
              onClick={() => {
                setFilterTag("");
                setSearch("");
              }}
              className={`nb-border mb-1.5 w-full px-2.5 py-1.5 text-left text-[11px] font-bold ${
                !filterTag ? "bg-primary text-black" : "bg-background hover:bg-secondary"
              }`}
            >
              All memories
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setFilterTag(tag);
                  setSearch("");
                }}
                className={`nb-border mb-1.5 flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-bold ${
                  filterTag === tag
                    ? "bg-primary text-black"
                    : "bg-background hover:bg-secondary"
                }`}
              >
                <Tag className="size-2.5 shrink-0" />
                <span className="truncate">{tag}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Search bar */}
          <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-4 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setFilterTag("");
              }}
              placeholder="Search memories..."
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
            <span className="text-[10px] font-bold text-muted-foreground">
              {displayMemories?.length ?? 0} results
            </span>
          </div>

          {/* Memory list */}
          <div className="flex-1 overflow-y-auto p-4">
            {displayMemories === undefined ? (
              <p className="py-10 text-center text-sm text-muted-foreground animate-pulse">
                Loading memories...
              </p>
            ) : displayMemories.length === 0 ? (
              <div className="nb-border nb-shadow mx-auto max-w-md bg-card p-8 text-center">
                <Brain className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-bold">
                  {search ? "No matching memories" : "No memories yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Try a different search term"
                    : "The agent will save durable facts here as it works across sessions."}
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-3">
                {displayMemories.map((m) => (
                  <div key={m._id} className="nb-border nb-shadow bg-card p-4">
                    {editingId === m._id ? (
                      /* Edit mode */
                      <div>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="nb-border h-20 w-full bg-background p-2 text-sm outline-none"
                        />
                        <input
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="tags: customer:acme, topic:billing"
                          className="nb-border mt-1 h-8 w-full bg-background px-2 text-[11px] outline-none"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(m._id)}
                            className="nb-border nb-lift bg-[#2ECC71] px-3 text-[10px] font-black text-black"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                            className="nb-border bg-card px-3 text-[10px] font-bold"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <>
                        <p className="text-sm leading-relaxed">{m.content}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {m.tags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => setFilterTag(tag)}
                              className="nb-border inline-flex items-center gap-0.5 bg-secondary px-1.5 py-0.5 text-[9px] font-bold hover:bg-primary hover:text-black"
                            >
                              <Tag className="size-2" />
                              {tag}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-foreground/10 pt-2">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="font-bold">{m.createdBy}</span>
                            <span>·</span>
                            <Link
                              to={`/session/${m.sourceSessionId}`}
                              className="flex items-center gap-0.5 underline decoration-2 hover:text-foreground"
                            >
                              <Link2 className="size-2.5" />
                              {m.sourceSessionTitle}
                            </Link>
                            <span>·</span>
                            <span>
                              {new Date(m.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(m)}
                              className="nb-border flex size-6 items-center justify-center bg-background hover:bg-secondary"
                            >
                              <Edit3 className="size-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(m._id)}
                              className="nb-border flex size-6 items-center justify-center bg-background hover:bg-[#FF5C5C] hover:text-white"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

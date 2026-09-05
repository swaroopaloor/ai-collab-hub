import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft,
  BookOpen,
  Edit3,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

type KBEntry = {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");

  const entries = useQuery(api.knowledgeBases.listKnowledgeBases) as
    | KBEntry[]
    | undefined;

  const searchResults = useQuery(
    api.knowledgeBases.searchKnowledgeBases,
    search ? { query: search } : "skip",
  ) as KBEntry[] | undefined;

  const createEntry = useMutation(api.knowledgeBases.createKnowledgeBase);
  const updateEntry = useMutation(api.knowledgeBases.updateKnowledgeBase);
  const deleteEntry = useMutation(api.knowledgeBases.deleteKnowledgeBase);

  const displayEntries = search ? searchResults : entries;
  const allTags = [
    ...new Set((entries ?? []).flatMap((e) => e.tags)),
  ].sort();

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await createEntry({ title: newTitle, content: newContent, tags });
      toast.success("Knowledge base article created");
      setNewTitle("");
      setNewContent("");
      setNewTags("");
      setShowNewForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const startEdit = (entry: KBEntry) => {
    setEditingId(entry._id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
    setEditTags(entry.tags.join(", "));
  };

  const saveEdit = async (kbId: string) => {
    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateEntry({
        kbId: kbId as never,
        title: editTitle,
        content: editContent,
        tags,
      });
      toast.success("Article updated");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (kbId: string) => {
    try {
      await deleteEntry({ kbId: kbId as never });
      toast.success("Article deleted");
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
          <span className="nb-border flex size-7 items-center justify-center bg-[#2ECC71] text-xs font-black text-black">
            <BookOpen className="size-4" />
          </span>
          <h1 className="text-sm font-black uppercase tracking-tight sm:text-base">
            Knowledge Base
          </h1>
        </div>
        <span className="nb-border hidden bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-widest sm:inline">
          agent searchable
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
                !filterTag
                  ? "bg-primary text-black"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              All articles
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
          {/* Top bar with search + add button */}
          <div className="nb-border flex shrink-0 items-center gap-2 border-x-0 border-b-0 bg-card px-4 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setFilterTag("");
              }}
              placeholder="Search articles..."
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
              {displayEntries?.length ?? 0} results
            </span>
            <Button
              size="sm"
              onClick={() => setShowNewForm(!showNewForm)}
              className="nb-border nb-lift h-8 bg-[#2ECC71] px-3 text-[10px] font-black text-black"
            >
              <Plus className="size-3.5" />
              Add article
            </Button>
          </div>

          {/* New article form */}
          {showNewForm && (
            <div className="nb-border mx-4 mt-4 rounded-none bg-card p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide">
                New knowledge base article
              </p>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Article title"
                className="nb-border h-9 bg-background text-sm"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Full article content the agent can reference..."
                className="nb-border mt-2 h-28 w-full bg-background p-2 text-sm outline-none resize-y"
              />
              <Input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Tags (comma-separated): billing, onboarding, api"
                className="nb-border mt-2 h-8 bg-background text-[11px]"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  className="nb-border nb-lift bg-[#2ECC71] px-3 text-[10px] font-black text-black"
                >
                  Save article
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewForm(false)}
                  className="nb-border bg-card px-3 text-[10px] font-bold"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Article list */}
          <div className="flex-1 overflow-y-auto p-4">
            {displayEntries === undefined ? (
              <p className="py-10 text-center text-sm text-muted-foreground animate-pulse">
                Loading articles...
              </p>
            ) : displayEntries.length === 0 ? (
              <div className="nb-border nb-shadow mx-auto max-w-md bg-card p-8 text-center">
                <BookOpen className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-bold">
                  {search ? "No matching articles" : "No articles yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Try a different search term"
                    : "Add articles so the agent can search your knowledge base during sessions."}
                </p>
                {!search && (
                  <Button
                    size="sm"
                    onClick={() => setShowNewForm(true)}
                    className="nb-border nb-lift mt-4 bg-primary px-4 text-xs font-bold text-black"
                  >
                    <Plus className="size-3.5" />
                    Add first article
                  </Button>
                )}
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-3">
                {displayEntries.map((entry) => (
                  <div
                    key={entry._id}
                    className="nb-border nb-shadow bg-card p-4"
                  >
                    {editingId === entry._id ? (
                      /* Edit mode */
                      <div>
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="nb-border h-8 w-full bg-background px-2 text-sm font-bold outline-none"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="nb-border mt-1 h-24 w-full bg-background p-2 text-sm outline-none resize-y"
                        />
                        <input
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder="tags: billing, onboarding"
                          className="nb-border mt-1 h-8 w-full bg-background px-2 text-[11px] outline-none"
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveEdit(entry._id)}
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
                        <p className="font-bold">{entry.title}</p>
                        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                          {entry.content.length > 300
                            ? entry.content.slice(0, 300) + "..."
                            : entry.content}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.tags.map((tag) => (
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
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(entry)}
                              className="nb-border flex size-6 items-center justify-center bg-background hover:bg-secondary"
                            >
                              <Edit3 className="size-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(entry._id)}
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

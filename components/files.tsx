"use client";

import { ArrowDownUp, BookOpen, Check, CheckSquare, Combine, Download, Ellipsis, FolderOpen, Pencil, Search, Share2, Trash, Upload, Wrench, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useT } from "@/lib/i18n";
import { type FileKind, kindOf, type LibFile, library, useLibrary } from "@/lib/library";
import { toolHref } from "@/lib/tools";

import { FileThumb } from "./thumbs";
import { downloadLib, downloadZip, shareLib, ToolChooser } from "./tool-kit";
import { ActionList, Button, Confirm, cx, formatBytes, IconButton, Sheet, Spinner, TextInput, useObjectUrl } from "./ui";

type Filter = "all" | "pdf" | "image" | "office";
type Sort = "newest" | "oldest" | "name" | "size";

function useDateLabel() {
  const t = useT();
  return (ms: number) => {
    const d = new Date(ms);
    const today = new Date();
    const y = new Date();
    y.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t("today");
    if (d.toDateString() === y.toDateString()) return t("yesterday");
    return d.toLocaleDateString(t.lang === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  };
}

function ImagePreview({ file, onClose }: { file: LibFile | null; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ id: string; blob?: Blob }>();
  const url = useObjectUrl(file && loaded?.id === file.id ? loaded.blob : undefined);
  useEffect(() => {
    if (file) void library.blob(file.id).then((blob) => setLoaded({ id: file.id, blob }));
  }, [file]);
  return (
    <Sheet open={!!file} onClose={onClose} title={file?.name} wide>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="mx-auto max-h-[70dvh] rounded-xl" /> : <Spinner className="mx-auto my-20 size-6" />}
    </Sheet>
  );
}

export function FilesScreen() {
  const t = useT();
  const router = useRouter();
  const files = useLibrary();
  const dateLabel = useDateLabel();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<LibFile | null>(null);
  const [renaming, setRenaming] = useState<LibFile | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [toolFor, setToolFor] = useState<string[] | null>(null);
  const [preview, setPreview] = useState<LibFile | null>(null);
  const importer = useRef<HTMLInputElement>(null);
  const press = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const out = (files ?? []).filter((f) => (filter === "all" || kindOf(f) === (filter as FileKind)) && (!q || f.name.toLocaleLowerCase().includes(q)));
    return out.sort((a, b) =>
      sort === "newest" ? b.createdAt - a.createdAt : sort === "oldest" ? a.createdAt - b.createdAt : sort === "name" ? a.name.localeCompare(b.name, t.lang) : b.size - a.size,
    );
  }, [files, query, filter, sort, t.lang]);

  const chosen = (files ?? []).filter((f) => selected.includes(f.id));
  const total = (files ?? []).reduce((n, f) => n + f.size, 0);

  const open = (f: LibFile) => {
    const k = kindOf(f);
    if (k === "pdf") router.push(`/view?id=${f.id}`);
    else if (k === "image") setPreview(f);
    else void downloadLib(f);
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const importFiles = async (picked: File[]) => {
    for (const f of picked) await library.add(f, f.name);
    if (picked.length) toast.success(t("webDropped", { count: picked.length }));
  };

  return (
    <div
      className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-16"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void importFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.035em] md:text-[44px]">{t("filesTitle")}</h1>
          <p className="mt-1 text-[15px] text-fg-2">{t("webFilesSub")}</p>
        </div>
        {!!files?.length && (
          <IconButton label={t("selectAll")} onClick={() => (setSelecting((s) => !s), setSelected([]))} className={cx(selecting && "bg-surface-alt text-fg")}>
            {selecting ? <X className="size-5" /> : <CheckSquare className="size-5" />}
          </IconButton>
        )}
        <Button icon={<Upload className="size-4" />} size="sm" onClick={() => importer.current?.click()}>
          {t("importFile")}
        </Button>
        <input
          ref={importer}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const f = Array.from(e.target.files ?? []);
            e.target.value = "";
            void importFiles(f);
          }}
        />
      </div>

      {files === null ? (
        <div className="grid place-items-center py-24">
          <Spinner className="size-6" />
        </div>
      ) : files.length === 0 ? (
        <div className="mt-10 grid place-items-center rounded-[28px] border-2 border-dashed border-line bg-surface px-6 py-16 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-alt text-fg-2">
            <FolderOpen className="size-6" />
          </span>
          <div className="text-[17px] font-bold">{t("filesEmptyTitle")}</div>
          <p className="mt-1 mb-5 max-w-sm text-[14px] text-fg-2">{t("filesEmptyBody")}</p>
          <Button icon={<Upload className="size-4" />} onClick={() => importer.current?.click()}>
            {t("importFile")}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <label className="flex h-11 min-w-0 flex-1 basis-60 items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-brand">
              <Search className="size-4 shrink-0 text-fg-3" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchFiles")} className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-3" />
            </label>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {(["all", "pdf", "image", "office"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cx("press h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold", filter === f ? "bg-fg text-bg" : "border border-line bg-surface text-fg-2 hover:text-fg")}
                >
                  {{ all: t("filterAll"), pdf: t("filterPdf"), image: t("filterImages"), office: t("filterOffice") }[f]}
                </button>
              ))}
            </div>
            <IconButton label={t("sortBy")} onClick={() => setSortOpen(true)} className="border border-line bg-surface">
              <ArrowDownUp className="size-4" />
            </IconButton>
          </div>

          {list.length === 0 ? (
            <p className="py-16 text-center text-fg-2">{t("noResults")}</p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {list.map((f) => {
                const on = selected.includes(f.id);
                return (
                  <div key={f.id} className="group relative">
                    <button
                      className="press block w-full text-left"
                      onClick={() => {
                        if (longPressed.current) return;
                        if (selecting) toggle(f.id);
                        else open(f);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenu(f);
                      }}
                      onPointerDown={(e) => {
                        if (e.pointerType !== "touch") return;
                        longPressed.current = false;
                        press.current = setTimeout(() => {
                          longPressed.current = true;
                          setSelecting(true);
                          toggle(f.id);
                          navigator.vibrate?.(10);
                        }, 450);
                      }}
                      onPointerUp={() => clearTimeout(press.current)}
                      onPointerLeave={() => clearTimeout(press.current)}
                    >
                      <div className={cx("relative overflow-hidden rounded-2xl border transition-shadow", on ? "border-brand ring-4 ring-[color-mix(in_srgb,var(--brand)_15%,transparent)]" : "border-line group-hover:shadow-card")}>
                        <FileThumb file={f} className="aspect-[3/4]" />
                        {selecting && (
                          <span className={cx("absolute top-2 left-2 grid size-6 place-items-center rounded-full border-2", on ? "border-brand bg-brand text-white" : "border-white bg-black/15")}>
                            {on && <Check className="size-3.5" strokeWidth={3} />}
                          </span>
                        )}
                        {f.pages && <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white">{t("pagesCount", { count: f.pages })}</span>}
                      </div>
                      <div className="mt-2 pr-8">
                        <div className="truncate text-[14px] font-semibold">{f.name}</div>
                        <div className="text-[12px] text-fg-3">
                          {formatBytes(f.size, t.lang)} · {dateLabel(f.createdAt)}
                        </div>
                      </div>
                    </button>
                    {!selecting && (
                      <IconButton label="…" className="absolute right-0 bottom-0 size-8" onClick={() => setMenu(f)}>
                        <Ellipsis className="size-4" />
                      </IconButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-10 text-center text-[13px] text-fg-3">
            {t("webStorageUsed", { size: formatBytes(total, t.lang) })} · {t("webLocalNote")}
          </p>
        </>
      )}

      {/* Selection bar */}
      {selecting && (
        <div className="fixed inset-x-3 bottom-[calc(16px+env(safe-area-inset-bottom,0px))] z-40 mx-auto flex max-w-lg items-center gap-1 rounded-2xl border border-line bg-surface p-2 pl-4 shadow-float md:bottom-6">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{t("selectedCount", { count: selected.length })}</span>
          {chosen.filter((f) => kindOf(f) === "pdf").length >= 2 && (
            <IconButton label={t("mergeSelected")} onClick={() => router.push(`${toolHref("merge")}?files=${chosen.filter((f) => kindOf(f) === "pdf").map((f) => f.id).join(",")}`)}>
              <Combine className="size-5" />
            </IconButton>
          )}
          <IconButton label={t("share")} disabled={!chosen.length} onClick={() => shareLib(chosen, t)}>
            <Share2 className="size-5" />
          </IconButton>
          <IconButton label={t("download")} disabled={!chosen.length} onClick={() => (chosen.length === 1 ? downloadLib(chosen[0]) : downloadZip(chosen, "PDFixx.zip"))}>
            <Download className="size-5" />
          </IconButton>
          <IconButton label={t("delete")} disabled={!chosen.length} className="text-danger" onClick={() => setDeleting(selected)}>
            <Trash className="size-5" />
          </IconButton>
        </div>
      )}

      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} title={t("sortBy")}>
        <ActionList
          items={(["newest", "oldest", "name", "size"] as Sort[]).map((s) => ({
            icon: sort === s ? <Check className="size-5 text-brand" /> : <span />,
            label: { newest: t("sortNewest"), oldest: t("sortOldest"), name: t("sortName"), size: t("sortSize") }[s],
            onClick: () => {
              setSort(s);
              setSortOpen(false);
            },
          }))}
        />
      </Sheet>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        {menu && (
          <ActionList
            items={[
              { icon: <BookOpen className="size-5" />, label: t("open"), onClick: () => (setMenu(null), open(menu)) },
              kindOf(menu) === "pdf" && { icon: <Wrench className="size-5" />, label: t("openWithTool"), onClick: () => (setMenu(null), setToolFor([menu.id])) },
              {
                icon: <Pencil className="size-5" />,
                label: t("rename"),
                onClick: () => {
                  setNewName(menu.name);
                  setRenaming(menu);
                  setMenu(null);
                },
              },
              { icon: <Download className="size-5" />, label: t("download"), onClick: () => (setMenu(null), void downloadLib(menu)) },
              { icon: <Share2 className="size-5" />, label: t("share"), onClick: () => (setMenu(null), void shareLib([menu], t)) },
              { icon: <Trash className="size-5" />, label: t("delete"), danger: true, onClick: () => (setMenu(null), setDeleting([menu.id])) },
            ]}
          />
        )}
      </Sheet>

      <Sheet open={!!renaming} onClose={() => setRenaming(null)} title={t("renameTitle")}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (renaming) await library.rename(renaming.id, newName);
            setRenaming(null);
          }}
        >
          <TextInput autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onFocus={(e) => e.target.setSelectionRange(0, e.target.value.lastIndexOf(".") > 0 ? e.target.value.lastIndexOf(".") : e.target.value.length)} />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!newName.trim()}>
              {t("save")}
            </Button>
          </div>
        </form>
      </Sheet>

      <Confirm
        open={!!deleting}
        title={t("deleteTitle", { count: deleting?.length ?? 1 })}
        body={t("deleteBody")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const ids = deleting ?? [];
          await library.remove(ids);
          setSelected([]);
          setSelecting(false);
          toast(t("deletedCount", { count: ids.length }));
        }}
      />
      <ToolChooser open={!!toolFor} onClose={() => setToolFor(null)} fileIds={toolFor ?? []} />
      <ImagePreview file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

"use client";

import { createStore, del, delMany, get, set, type UseStore } from "idb-keyval";
import { useSyncExternalStore } from "react";

/**
 * "Dosyalarım": files the user opened or created, kept in this browser's
 * IndexedDB. Nothing here leaves the device.
 */
export type LibFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  pages?: number;
};

export type FileKind = "pdf" | "image" | "office" | "other";

export function kindOf(f: { name: string; type?: string }): FileKind {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || f.type === "application/pdf") return "pdf";
  if (f.type?.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext)) return "image";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf"].includes(ext)) return "office";
  return "other";
}

let store: UseStore | undefined;
const db = () => (store ??= createStore("pdfixx", "library"));

let files: LibFile[] = [];
let loaded = false;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loading ??= (async () => {
    try {
      files = ((await get<LibFile[]>("files", db())) ?? []).sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      files = [];
    }
    loaded = true;
    emit();
  })();
  return loading;
}

async function persist() {
  await set("files", files, db());
  emit();
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function uniqueName(name: string): string {
  const taken = new Set(files.map((f) => f.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export const library = {
  async add(blob: Blob, name: string, extra: Partial<LibFile> = {}): Promise<LibFile> {
    await load();
    const f: LibFile = {
      id: uid(),
      name: uniqueName(name),
      type: blob.type || guessType(name),
      size: blob.size,
      createdAt: Date.now(),
      ...extra,
    };
    await set(`blob:${f.id}`, blob, db());
    files = [f, ...files];
    await persist();
    return f;
  },

  async blob(id: string): Promise<Blob | undefined> {
    return get<Blob>(`blob:${id}`, db());
  },

  async file(id: string): Promise<LibFile | undefined> {
    await load();
    return files.find((f) => f.id === id);
  },

  /** The stored file as a File object, ready for tools. */
  async asFile(id: string): Promise<File | undefined> {
    const meta = await library.file(id);
    const blob = await library.blob(id);
    if (!meta || !blob) return undefined;
    return new File([blob], meta.name, { type: meta.type, lastModified: meta.createdAt });
  },

  async rename(id: string, name: string) {
    await load();
    const clean = name.trim();
    if (!clean) return;
    files = files.map((f) => (f.id === id ? { ...f, name: uniqueName(clean) } : f));
    await persist();
  },

  async update(id: string, patch: Partial<LibFile>) {
    await load();
    files = files.map((f) => (f.id === id ? { ...f, ...patch } : f));
    await persist();
  },

  /** Replaces the file's contents in place (e.g. after saving annotations). */
  async replace(id: string, blob: Blob) {
    await load();
    await set(`blob:${id}`, blob, db());
    await del(`thumb:${id}`, db());
    files = files.map((f) => (f.id === id ? { ...f, size: blob.size } : f));
    await persist();
  },

  async remove(ids: string[]) {
    await load();
    await delMany(
      ids.flatMap((id) => [`blob:${id}`, `thumb:${id}`]),
      db(),
    );
    files = files.filter((f) => !ids.includes(f.id));
    await persist();
  },

  async thumb(id: string): Promise<Blob | undefined> {
    return get<Blob>(`thumb:${id}`, db());
  },

  async setThumb(id: string, blob: Blob) {
    await set(`thumb:${id}`, blob, db());
  },

  totalSize: () => files.reduce((n, f) => n + f.size, 0),
};

function guessType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    zip: "application/zip",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  void load();
  return () => listeners.delete(l);
};

const empty: LibFile[] = [];

/** All files, newest first. `null` until IndexedDB has been read. */
export function useLibrary(): LibFile[] | null {
  return useSyncExternalStore(
    subscribe,
    () => (loaded ? files : null),
    () => null,
  ) ?? (loaded ? empty : null);
}

"use client";

import { Check, Loader2, X } from "lucide-react";
import { type ComponentProps, type CSSProperties, type ReactNode, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";

import { useT } from "@/lib/i18n";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ buttons

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "ai";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "press relative inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed",
        size === "sm" && "h-9 rounded-xl px-3 text-sm",
        size === "md" && "h-11 rounded-2xl px-4 text-[15px]",
        size === "lg" && "h-14 rounded-2xl px-6 text-base",
        variant === "primary" && "bg-brand text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_6px_16px_-6px_rgb(232_57_77/0.6)] hover:bg-brand-deep",
        variant === "ai" && "ai-gradient text-white shadow-[0_6px_16px_-6px_rgb(109_59_245/0.55)]",
        variant === "secondary" && "border border-line bg-surface text-fg hover:bg-surface-alt",
        variant === "ghost" && "text-fg-2 hover:bg-surface-alt hover:text-fg",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={cx("press grid size-10 shrink-0 place-items-center rounded-full text-fg-2 hover:bg-surface-alt hover:text-fg disabled:opacity-40", className)}
    >
      {children}
    </button>
  );
}

/** The tinted rounded square that holds a tool's icon, as in the app. */
export function IconTile({ color, size = 44, children, solid }: { color: string; size?: number; children: ReactNode; solid?: boolean }) {
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        color: solid ? "#fff" : color,
        background: solid ? color : `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-end justify-between px-1 pb-3", className)}>
      <h2 className="text-[17px] font-bold tracking-[-0.01em] text-fg">{children}</h2>
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-fg-3", className)} />;
}

// ------------------------------------------------------------------ inputs

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-fg-2">{label}</span>}
      {children}
      {error ? <span className="mt-1.5 block text-[13px] text-danger">{error}</span> : hint && <span className="mt-1.5 block text-[13px] text-fg-3">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: ComponentProps<"input">) {
  return (
    <input
      {...rest}
      className={cx(
        "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-fg outline-none placeholder:text-fg-3 focus:border-brand focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_14%,transparent)]",
        className,
      )}
    />
  );
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("flex rounded-2xl bg-surface-alt p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "press h-9 flex-1 rounded-xl px-2 text-[13px] font-semibold",
            o.value === value ? "bg-surface text-fg shadow-card" : "text-fg-2 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Large choice cards with a title and subtitle (compression level, split mode…). */
export function ChoiceList<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; sub?: string; icon?: ReactNode }[];
}) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "press flex items-center gap-3 rounded-2xl border bg-surface p-4 text-left",
              on ? "border-brand ring-4 ring-[color-mix(in_srgb,var(--brand)_10%,transparent)]" : "border-line hover:border-fg-3",
            )}
          >
            {o.icon}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-fg">{o.title}</span>
              {o.sub && <span className="mt-0.5 block text-[13px] text-fg-2">{o.sub}</span>}
            </span>
            <span className={cx("grid size-6 shrink-0 place-items-center rounded-full border-2", on ? "border-brand bg-brand text-white" : "border-line")}>
              {on && <Check className="size-3.5" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-medium text-fg">{label}</span>
        {sub && <span className="block text-[13px] text-fg-2">{sub}</span>}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200", checked ? "bg-success" : "bg-line")}
      >
        <span
          className="absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-200 ease-[var(--ease-out)]"
          style={{ transform: checked ? "translateX(20px)" : "none" }}
        />
      </button>
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="mb-2 flex justify-between text-[13px] font-semibold text-fg-2">
        <span>{label}</span>
        <span className="tabular-nums text-fg">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--brand)]"
        style={{ background: `linear-gradient(to right, var(--brand) ${pct}%, var(--border) ${pct}%)` } as CSSProperties}
      />
    </label>
  );
}

// ------------------------------------------------------------------ sheets

const mq = "(min-width: 768px)";
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(mq);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(mq).matches,
    () => true,
  );
}

/**
 * A modal panel: a bottom sheet you can swipe down on phones, a centered
 * dialog on larger screens.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const desktop = useIsDesktop();
  const t = useT();
  useEffect(() => {
    if (!open || !desktop) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, desktop, onClose]);

  if (desktop) {
    if (!open) return null;
    return createPortal(
      <div className="fixed inset-0 z-50 grid place-items-center p-6" role="dialog" aria-modal="true">
        <div className="sheet-overlay absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
        <div
          className={cx(
            "sheet-panel relative flex max-h-[min(86vh,820px)] w-full flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-float",
            wide ? "max-w-3xl" : "max-w-lg",
          )}
        >
          {title && (
            <div className="flex items-center gap-3 px-6 pt-5 pb-3">
              <h3 className="min-w-0 flex-1 truncate text-lg font-bold tracking-[-0.01em]">{title}</h3>
              <IconButton label={t("close")} onClick={onClose} className="-mr-2">
                <X className="size-5" />
              </IconButton>
            </div>
          )}
          <div className="scroll-area min-h-0 flex-1 px-6 pb-6">{children}</div>
          {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] border-t border-line bg-surface outline-none">
          <div className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-line" />
          <Drawer.Title className={cx("px-5 pt-2 pb-3 text-lg font-bold tracking-[-0.01em]", !title && "sr-only")}>{title ?? "PDFixx"}</Drawer.Title>
          <Drawer.Description className="sr-only">{typeof title === "string" ? title : "PDFixx"}</Drawer.Description>
          <div className="scroll-area min-h-0 flex-1 px-5 pb-5">{children}</div>
          {footer && <div className="border-t border-line px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">{footer}</div>}
          {!footer && <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** A list of actions in a sheet (file menu, etc.). */
export function ActionList({ items }: { items: ({ icon: ReactNode; label: string; onClick: () => void; danger?: boolean } | false)[] }) {
  return (
    <div className="-mx-2 grid">
      {items.filter(Boolean).map((it) => {
        const i = it as Exclude<typeof it, false>;
        return (
          <button
            key={i.label}
            onClick={i.onClick}
            className={cx("press flex h-12 items-center gap-4 rounded-2xl px-3 text-left text-[15px] font-medium hover:bg-surface-alt", i.danger ? "text-danger" : "text-fg")}
          >
            <span className={cx("grid size-5 place-items-center", i.danger ? "text-danger" : "text-fg-2")}>{i.icon}</span>
            {i.label}
          </button>
        );
      })}
    </div>
  );
}

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="text-[15px] text-fg-2">{body}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

/** Objects URLs for blobs, revoked when the component unmounts. */
export function useObjectUrl(blob: Blob | undefined | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- object URLs are an external resource
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function formatBytes(bytes: number, lang: "tr" | "en" = "tr"): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v.toLocaleString(lang === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: i === 0 ? 0 : v < 10 ? 1 : 0 })} ${units[i]}`;
}

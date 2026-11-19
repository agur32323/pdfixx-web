"use client";

import { Info, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { useT } from "@/lib/i18n";
import { bytesOf, protect, unlock } from "@/lib/pdf/engine";
import type { ToolDef } from "@/lib/tools";

import { DropZone, InputRow, OptionCard, outName, pdfBlob, ToolScaffold, useInputs, useJob } from "../tool-kit";
import { cx, Field, TextInput } from "../ui";

function strength(p: string): 0 | 1 | 2 {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^\w\s]/.test(p)) score++;
  return score >= 4 ? 2 : score >= 2 ? 1 : 0;
}

export function ProtectTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const job = useJob(tool);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const s = strength(pw);
  const error = pw && pw.length < 4 ? t("protectTooShort") : confirm && confirm !== pw ? t("protectMismatch") : null;

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stageProtecting"));
      const out = await protect(await bytesOf(input.file), pw, input.password);
      return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_protected") }] };
    });

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => {
        setInputs([]);
        setPw("");
        setConfirm("");
      }}
      action={input ? { label: t("protectAction"), onClick: run, disabled: pw.length < 4 || pw !== confirm } : undefined}
    >
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          {input.encrypted && (
            <p className="flex items-start gap-2 rounded-2xl bg-surface-alt p-3 text-[14px] text-fg-2">
              <Info className="mt-0.5 size-4 shrink-0" /> {t("protectAlready")}
            </p>
          )}
          <OptionCard>
            <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
              <input type="text" name="username" autoComplete="username" value={input.file.name} readOnly hidden />
              <Field label={t("protectPassword")}>
                <TextInput type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </Field>
              {pw && (
                <div className="-mt-2 flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-3 gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 rounded-full transition-colors duration-200"
                        style={{ background: i <= s ? ["var(--danger)", "var(--to-pdf)", "var(--success)"][s] : "var(--border)" }}
                      />
                    ))}
                  </div>
                  <span className="text-[12px] font-semibold text-fg-2">{[t("strengthWeak"), t("strengthMedium"), t("strengthStrong")][s]}</span>
                </div>
              )}
              <Field label={t("protectConfirm")} error={error}>
                <TextInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
            </form>
            <p className="mt-4 flex items-start gap-2 text-[13px] text-fg-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> {t("protectInfo")}
            </p>
          </OptionCard>
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

export function UnlockTool({ tool }: { tool: ToolDef }) {
  const t = useT();
  const { inputs, setInputs, add, passwordSheet } = useInputs();
  const input = inputs[0];
  const job = useJob(tool);

  const run = () =>
    job.run(async (c) => {
      c.stage(t("stageUnlocking"));
      const out = await unlock(await bytesOf(input.file), input.password ?? "");
      return { outputs: [{ blob: pdfBlob(out), name: outName(input.file.name, "_unlocked") }] };
    });

  return (
    <ToolScaffold
      tool={tool}
      job={job}
      onNewFile={() => setInputs([])}
      action={input ? { label: t("unlockRemove"), onClick: run, disabled: !input.encrypted } : undefined}
    >
      {!input ? (
        <DropZone accept={tool.accept} onFiles={add} />
      ) : (
        <div className="grid gap-4">
          <InputRow input={input} onChange={() => setInputs([])} />
          <div
            className={cx(
              "flex items-start gap-3 rounded-2xl p-4 text-[15px]",
              input.encrypted ? "bg-[color-mix(in_srgb,var(--success)_10%,var(--surface))] text-fg" : "bg-surface-alt text-fg-2",
            )}
          >
            {input.encrypted ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" /> : <Info className="mt-0.5 size-5 shrink-0" />}
            {input.encrypted ? t("unlockReady") : t("unlockNotEncrypted")}
          </div>
          <p className="text-[13px] text-fg-3">{t("unlockInfo")}</p>
        </div>
      )}
      {passwordSheet}
    </ToolScaffold>
  );
}

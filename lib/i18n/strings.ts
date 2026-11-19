// Strings shared by server and client code.
import appEn from "./app.en.json";
import appTr from "./app.tr.json";
import webEn from "./web.en.json";
import webTr from "./web.tr.json";

export type Lang = "tr" | "en";
type Params = Record<string, string | number>;

// App strings come from the mobile app (scripts/sync-strings.mjs); web.*.json
// holds the few that only the site needs.
export const dicts: Record<Lang, Record<string, string>> = {
  tr: { ...appTr, ...webTr },
  en: { ...appEn, ...webEn },
};

export type StringKey = keyof typeof appTr | keyof typeof webTr;

/** Finds the `}` that closes the `{` at `start`. */
function closing(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return s.length - 1;
}

/** Supports `{name}` and ICU `{count, plural, =0{…} =1{…} other{…}}`. */
export function format(template: string, params: Params = {}): string {
  let out = "";
  for (let i = 0; i < template.length; i++) {
    if (template[i] !== "{") {
      out += template[i];
      continue;
    }
    const end = closing(template, i);
    const body = template.slice(i + 1, end);
    const plural = body.match(/^\s*(\w+)\s*,\s*plural\s*,(.*)$/s);
    if (plural) {
      const n = Number(params[plural[1]] ?? 0);
      const cases: Record<string, string> = {};
      const rest = plural[2];
      for (let j = 0; j < rest.length; j++) {
        const m = rest.slice(j).match(/^\s*(=\d+|\w+)\s*\{/);
        if (!m) break;
        const open = j + m[0].length - 1;
        const close = closing(rest, open);
        cases[m[1]] = rest.slice(open + 1, close);
        j = close;
      }
      const chosen = cases[`=${n}`] ?? (n === 1 ? cases.one : undefined) ?? cases.other ?? "";
      out += format(chosen, params);
    } else {
      const key = body.trim();
      out += key in params ? String(params[key]) : `{${key}}`;
    }
    i = end;
  }
  return out;
}

export type T = ((key: StringKey, params?: Params) => string) & { lang: Lang };

export function makeT(lang: Lang): T {
  const dict = dicts[lang];
  const fn = ((key: StringKey, params?: Params) => format(dict[key] ?? dicts.tr[key] ?? key, params)) as T;
  fn.lang = lang;
  return fn;
}

/** For server components (metadata), which can't use hooks. */
export function serverT(lang: Lang): T {
  return makeT(lang);
}

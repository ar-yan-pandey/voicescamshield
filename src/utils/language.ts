import { franc } from "franc";
import langs from "langs";

export type DetectedLanguage = { code: string; name: string };

export const SUPPORTED_LANGS: { code: string; name: string }[] = [
  "en","es","fr","de","hi","zh","ja","ko","ru","ar",
  "pt","it","nl","tr","vi","th","pl","sv","no","da",
  "fi","cs","el","he","uk","id","ms","ro","hu","ta",
  "te","bn","ur"
].map((code) => {
  const lang = langs.where("1", code);
  return { code, name: lang ? lang.name : code.toUpperCase() };
});

export function detectLanguageFromText(text: string): DetectedLanguage | null {
  try {
    const three = franc(text || "", { minLength: 10 });
    if (!three || three === "und") return null;
    const info = langs.where("3", three);
    if (!info) return null;
    const code2 = (info as any)["1"] as string | undefined;
    if (!code2) return null;
    return { code: code2, name: info.name };
  } catch {
    return null;
  }
}

import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_LANGS } from "@/utils/language";
import type { DetectedLanguage } from "@/utils/language";

type Props = {
  detected: DetectedLanguage | null;
  selected: string | null; // ISO 639-1
  onChange: (code: string | null) => void;
};

const LanguageSelector: React.FC<Props> = ({ detected, selected, onChange }) => {
  return (
    <div className="w-full">
      <Select value={selected ?? "auto"} onValueChange={(v) => onChange(v === "auto" ? null : v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose language" />
        </SelectTrigger>
        <SelectContent className="z-50">
          <SelectItem value="auto">Auto {detected ? `(Detected: ${detected.name})` : ""}</SelectItem>
          {SUPPORTED_LANGS.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;

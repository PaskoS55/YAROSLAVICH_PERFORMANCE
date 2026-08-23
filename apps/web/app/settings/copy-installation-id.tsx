"use client";
import { useState } from "react";
export function CopyInstallationId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="link-action ml-2 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      }}
    >
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

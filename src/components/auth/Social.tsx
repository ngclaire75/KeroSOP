"use client";

import { useEffect, useState } from "react";
import { cancelled, continueWithGoogle, explain, preloadAuth } from "@/lib/auth";

/**
 * Google button above the email form, then an "or with email" label. Errors show
 * under the button; closing the popup just resets it.
 */
export function Social({ verb, disabled, onSuccess }: { verb: string; disabled?: boolean; onSuccess(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(preloadAuth, []);

  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await continueWithGoogle();
      onSuccess();
    } catch (err) {
      setBusy(false);
      if (!cancelled(err)) setError(explain(err).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={go}
        // Stays clickable while busy: Firebase takes seconds to notice a closed popup, and a new click replaces it
        disabled={disabled}
        aria-busy={busy}
        className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full border border-ink/20 bg-paper px-5 text-[15px] font-semibold transition-colors hover:border-ink disabled:cursor-default disabled:hover:border-ink/20"
      >
        <GoogleMark />
        {busy ? "Opening Google…" : `${verb} Google`}
      </button>
      {error && (
        <p role="alert" className="text-center text-[14px] leading-[1.45] text-red">
          {error}
        </p>
      )}
      <p className="text-center font-mono text-[12px] tracking-[0.18em] text-mute uppercase" aria-hidden="true">
        Or with email
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px] shrink-0" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

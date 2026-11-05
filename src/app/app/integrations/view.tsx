"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLogo, INTEGRATIONS } from "@/components/app/BrandLogo";
import { Icon } from "@/components/app/icons";
import { PageHeader, orgName, useToast } from "@/components/app/ui";
import { useWorkspace } from "@/lib/app/store";

/** Marks whose official colour is near-black are shown in white on the black cards. */
const MONO = new Set(["github", "notion", "slack", "confluence"]);
const CARD = "rounded-[7px] border border-white/[0.08] bg-[#0b0b0b] text-white";
const FIELD =
  "h-11 w-full rounded-[9px] border border-white/12 bg-white/[0.05] px-3.5 text-[14px] text-white outline-none transition-colors placeholder:text-white hover:border-white/25 focus:border-white/60 disabled:opacity-50";
const BTN = "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4.5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const host = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
};

function Logo({ brand, size = "size-7" }: { brand: string; size?: string }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
      <BrandLogo brand={brand} mono={MONO.has(brand)} className={`${size} ${MONO.has(brand) ? "text-white" : ""}`} />
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-white">{label}</span>
      {children}
      {hint && <span className="text-[13px] leading-[1.5] text-white">{hint}</span>}
    </label>
  );
}

/** Descriptions in the same row of cards take the same number of lines: if any wraps to two, the row gets two; otherwise it stays on one. */
function useEvenLines() {
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = grid.current;
    if (!box) return;
    const even = () => {
      const lines = [...box.querySelectorAll<HTMLElement>("[data-desc]")];
      lines.forEach((el) => (el.style.minHeight = ""));
      const lh = lines[0] ? parseFloat(getComputedStyle(lines[0]).lineHeight) : 0;
      if (!lh) return;
      // cards in the same row share a top edge; each row matches its own longest description
      const rows = new Map<number, HTMLElement[]>();
      lines.forEach((el) => {
        const top = Math.round((el.closest<HTMLElement>("button, div[class*='rounded']") ?? el).getBoundingClientRect().top);
        rows.set(top, [...(rows.get(top) ?? []), el]);
      });
      rows.forEach((row) => {
        const most = Math.max(...row.map((el) => Math.round(el.offsetHeight / lh)));
        row.forEach((el) => (el.style.minHeight = `${most * lh}px`));
      });
    };
    even();
    const ro = new ResizeObserver(even);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  return grid;
}

export default function IntegrationsPage() {
  const { ws, importUrl, updateSettings, me } = useWorkspace();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [hook, setHook] = useState(ws.settings.webhook);
  const importRef = useRef<HTMLInputElement>(null);
  const hookRef = useRef<HTMLInputElement>(null);
  const admin = ["owner", "admin"].includes(me.role);
  const canImport = ["owner", "admin", "editor"].includes(me.role);
  const company = orgName(ws.settings.company);

  const doImport = async () => {
    setBusy(true);
    try {
      const r = await importUrl(url.trim(), { authority: "department_sop", approval: "draft" });
      toast(`Imported as ${r.id} (draft, ${r.sections} sections)`);
      setUrl("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const saveHook = async (value: string) => {
    setBusy(true);
    try {
      await updateSettings({ webhook: value.trim() });
      toast(value.trim() ? "Alerts will be sent there" : "Alerts turned off");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    try {
      const body = /hooks\.slack\.com/.test(hook) ? { text: `KeroSOP · ${company}: test message from Integrations` } : { source: "kerosop", workspace: company, text: "Test message", at: new Date().toISOString() };
      await fetch(hook, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) });
      toast("Test sent. Check the channel or workflow.");
    } catch {
      toast("Could not reach that address.", "error");
    }
  };
  const goTo = (el: HTMLInputElement | null) => {
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };

  const live = INTEGRATIONS.filter((i) => i.status === "live");
  const next = INTEGRATIONS.filter((i) => i.status !== "live");
  const liveGrid = useEvenLines();
  const nextGrid = useEvenLines();

  return (
    <>
      <PageHeader title="Integrations" intro="Bring documents in from where they live and send alerts to where your team works. Each connection starts only when an admin sets it up." />

      {/* the two connections that work today */}
      <div className="grid gap-4">
        <section className={`${CARD} flex flex-col p-6 sm:p-7`}>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <Logo brand="github" />
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold">Import from GitHub</h2>
              <p className="mt-1 text-[14px] leading-[1.55] text-white">Public Markdown, TXT, PDF or DOCX files. Imports start as drafts until you approve them.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Field label="File link" hint="Only github.com and raw.githubusercontent.com links are accepted.">
              <input ref={importRef} className={FIELD} placeholder="https://github.com/owner/repo/blob/main/policy.md" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
          </div>
          <div className="pt-4">
            <button type="button" disabled={!canImport || busy || !url.trim()} onClick={doImport} className={`${BTN} bg-red text-white hover:bg-red-deep`}>
              Import document
            </button>
          </div>
        </section>

        <section className={`${CARD} flex flex-col p-6 sm:p-7`}>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <div className="flex -space-x-2">
              {["slack", "n8n", "zapier", "make"].map((b) => (
                <span key={b} className="grid size-12 place-items-center rounded-full border border-white/10 bg-[#141414]">
                  <BrandLogo brand={b} mono={MONO.has(b)} className={`size-6 ${MONO.has(b) ? "text-white" : ""}`} />
                </span>
              ))}
            </div>
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold">Alerts to your team</h2>
              <p className="mt-1 text-[14px] leading-[1.55] text-white">New findings, assignments, approvals and finished scans, posted to Slack, n8n, Zapier or Make.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Field label="Webhook address" hint="Slack links get a plain message; any other https address gets JSON with the event and a link to the finding.">
              <input ref={hookRef} className={FIELD} placeholder="https://hooks.slack.com/services/…" value={hook} onChange={(e) => setHook(e.target.value)} disabled={!admin} />
            </Field>
            {ws.settings.webhook && <p className="text-[13px] text-white">Sending alerts to {host(ws.settings.webhook)}.</p>}
          </div>
          <div className="flex flex-wrap gap-2 pt-4">
            <button type="button" disabled={!admin || busy || hook === ws.settings.webhook} onClick={() => saveHook(hook)} className={`${BTN} bg-red text-white hover:bg-red-deep`}>
              Save
            </button>
            <button type="button" disabled={!hook.startsWith("https://")} onClick={test} className={`${BTN} border border-white bg-white text-black hover:bg-white/90`}>
              Send test
            </button>
            {ws.settings.webhook && (
              <button type="button" disabled={!admin || busy} onClick={() => (setHook(""), saveHook(""))} className={`${BTN} text-white hover:text-white`}>
                Disconnect
              </button>
            )}
          </div>
        </section>
      </div>

      {/* every connection, as black cards */}
      <h2 className="mt-12 text-[18px] font-bold">Available now</h2>
      <p className="mt-1 text-[14px] text-mute">Set these up above.</p>
      <div ref={liveGrid} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {live.map((i) => (
          <button
            key={i.name}
            type="button"
            onClick={() => goTo(i.brand === "github" ? importRef.current : hookRef.current)}
            className={`${CARD} group flex items-start gap-4 p-5 text-left transition-colors hover:border-white/30`}
          >
            <Logo brand={i.brand} />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold">{i.name}</span>
              <span data-desc className="mt-1 block text-[13px] leading-[1.5] text-white">{i.what}</span>
            </span>
            <Icon name="arrow" className="mt-1 size-4 text-white transition-colors group-hover:text-white" />
          </button>
        ))}
      </div>

      <h2 className="mt-12 text-[18px] font-bold">Coming next</h2>
      <p className="mt-1 text-[14px] text-mute">These need an app registered with each provider and are not connected yet.</p>
      <div ref={nextGrid} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {next.map((i) => (
          <div key={i.name} className={`${CARD} flex items-start gap-4 p-5`}>
            <Logo brand={i.brand} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold">{i.name}</p>
              <p data-desc className="mt-1 text-[13px] leading-[1.5] text-white">{i.what}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

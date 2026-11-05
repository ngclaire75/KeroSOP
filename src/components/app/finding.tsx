"use client";

/**
 * Pieces shared by Findings and Review & Approve: risk and status pills, the
 * lifecycle track, the next-step actions for a finding, and its notes.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Btn, Input, Select, Textarea, fmtDateTime, useToast } from "@/components/app/ui";
import { useWorkspace } from "@/lib/app/store";
import { prefersReducedMotion } from "@/lib/random";
import { RISK_NAME, STATUS_LABEL, type Finding, type Risk, type Status } from "@/lib/app/types";

export const PILL = "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap";

export const RISK_LOOK: Record<Risk, string> = { high: "bg-red text-white", medium: "border border-ink/35 text-ink", low: "border border-line text-mute" };
export const STATUS_LOOK: Record<Status, string> = {
  detected: "border border-red text-red",
  under_review: "border border-ink/35 text-ink",
  confirmed: "bg-ink text-paper",
  assigned: "bg-ink text-paper",
  revision_proposed: "border border-ink/35 text-ink",
  approved: "bg-ink text-paper",
  rejected: "bg-red text-white",
  rescanned: "border border-ink/35 text-ink",
  closed: "border border-line text-mute",
  dismissed: "border border-line text-mute",
};

export const RiskPill = ({ risk }: { risk: Risk }) => <span className={`${PILL} ${RISK_LOOK[risk]}`}>{RISK_NAME[risk]}</span>;
export const StatusPill = ({ status }: { status: Status }) => <span className={`${PILL} ${STATUS_LOOK[status]}`}>{STATUS_LABEL[status]}</span>;

/* ---------- lifecycle track ---------- */

const LIFE = ["Open", "In review", "Confirmed", "Assigned", "Revision", "Approved", "Re-scanned", "Closed"];
const LIFE_AT: Record<Status, number> = { detected: 0, under_review: 1, confirmed: 2, assigned: 3, rejected: 3, revision_proposed: 4, approved: 5, rescanned: 6, closed: 7, dismissed: -1 };
const GRADIENT: CSSProperties = {
  backgroundImage: "linear-gradient(90deg, #7a0009 0%, #b8000d 30%, #e30613 65%, #ff5547 100%)",
  backgroundSize: `${LIFE.length * 100}% 100%`,
};

/** Where the finding is in its life, as one red gradient track; segments fill in order with anime.js. */
export function LifeTrack({ status }: { status: Status }) {
  const ref = useRef<HTMLOListElement>(null);
  const at = LIFE_AT[status];
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    import("animejs").then(({ animate, stagger }) => {
      animate(el.querySelectorAll("[data-fill]"), { scaleX: [0, 1], duration: 460, delay: stagger(80), ease: "outQuart" });
      animate(el.querySelectorAll("[data-label]"), { opacity: [0, 1], duration: 380, delay: stagger(80, { start: 100 }), ease: "outQuart" });
    });
  }, [status]);
  return (
    <ol ref={ref} className="grid grid-cols-8 gap-1">
      {LIFE.map((label, i) => {
        const done = at >= 0 && i <= at;
        return (
          <li key={label} className="min-w-0">
            <span className={`relative block h-2 overflow-hidden bg-line ${i === 0 ? "rounded-l-full" : ""} ${i === LIFE.length - 1 ? "rounded-r-full" : ""}`}>
              {done && <span data-fill className="absolute inset-0 origin-left" style={{ ...GRADIENT, backgroundPosition: `${(i / (LIFE.length - 1)) * 100}% 0` }} />}
            </span>
            <span data-label className={`mt-2 block truncate text-[11px] ${i === at ? "font-semibold text-red" : done ? "text-ink" : "text-mute"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- next step for this finding ---------- */

export function Actions({ f }: { f: Finding }) {
  const { ws, me, setStatus, assign, proposeRevision, decideRevision, reverify } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"dismiss" | "close" | null>(null);
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState(f.owner ?? "");
  const [due, setDue] = useState(f.dueDate ?? "");
  const cited = f.evidence.filter((e) => !e.baseline);
  const [clause, setClause] = useState(0);
  const [proposed, setProposed] = useState(cited[0]?.quote ?? "");
  const review = ["owner", "admin", "reviewer", "approver"].includes(me.role);
  const propose = ["owner", "admin", "editor", "reviewer"].includes(me.role);
  const approve = ["owner", "admin", "approver"].includes(me.role);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  let title = "";
  let body: ReactNode = null;
  if (mode) {
    title = mode === "dismiss" ? "Dismiss this finding" : "Close without a confirming re-scan";
    body = (
      <>
        <Textarea label="Reason" hint="Kept in the audit trail" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "dismiss" ? "Why this is not a real conflict" : "Why it is safe to close"} />
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setMode(null)}>Cancel</Btn>
          <Btn variant={mode === "dismiss" ? "danger" : "ink"} disabled={busy || !note.trim()} onClick={() => run(() => setStatus(f.id, mode === "dismiss" ? "dismissed" : "closed", note.trim()), mode === "dismiss" ? "Dismissed" : "Closed")}>
            {mode === "dismiss" ? "Dismiss" : "Close finding"}
          </Btn>
        </div>
      </>
    );
  } else if ((f.status === "detected" || f.status === "under_review") && review) {
    title = f.status === "detected" ? "Review this finding" : "Decide";
    body = (
      <div className="flex flex-wrap gap-2">
        {f.status === "detected" ? (
          <Btn variant="ink" disabled={busy} onClick={() => run(() => setStatus(f.id, "under_review"), "Moved to review")}>
            Start review
          </Btn>
        ) : (
          <Btn variant="red" disabled={busy} onClick={() => run(() => setStatus(f.id, "confirmed"), "Confirmed")}>
            Confirm conflict
          </Btn>
        )}
        <Btn disabled={busy} onClick={() => setMode("dismiss")}>
          Dismiss
        </Btn>
        {f.status === "under_review" && (
          <Btn variant="ghost" disabled={busy} onClick={() => run(() => setStatus(f.id, "detected"), "Moved back to open")}>
            Back to open
          </Btn>
        )}
      </div>
    );
  } else if ((f.status === "confirmed" || f.status === "rejected") && review) {
    title = f.status === "rejected" ? "Revision rejected: assign again or propose new wording" : "Assign an owner";
    body = (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} options={[{ value: "", label: "Choose a person" }, ...ws.members.map((m) => ({ value: m.name, label: m.name }))]} />
          <Input label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Btn disabled={busy} onClick={() => setMode("dismiss")}>
            Dismiss
          </Btn>
          <Btn variant="ink" disabled={busy || !owner} onClick={() => run(() => assign(f.id, owner, due || undefined), `Assigned to ${owner}`)}>
            Assign
          </Btn>
        </div>
      </>
    );
  } else if (f.status === "assigned" && propose && cited.length) {
    title = "Propose new wording";
    body = (
      <>
        {cited.length > 1 && (
          <Select
            label="Clause to change"
            value={String(clause)}
            onChange={(e) => {
              setClause(Number(e.target.value));
              setProposed(cited[Number(e.target.value)].quote);
            }}
            options={cited.map((e, i) => ({ value: String(i), label: `Clause ${String.fromCharCode(65 + i)} · ${ws.docs.find((d) => d.id === e.docId)?.title ?? e.docId} §${e.sectionRef}` }))}
          />
        )}
        <Textarea label="Replacement wording" maxWords={500} value={proposed} onChange={(e) => setProposed(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Btn
            variant="ink"
            disabled={busy || !proposed.trim() || proposed.trim() === cited[clause].quote.trim()}
            onClick={() => run(() => proposeRevision(f.id, cited[clause].docId, cited[clause].sectionId, cited[clause].quote, proposed.trim()), "Revision proposed")}
          >
            Propose revision
          </Btn>
        </div>
      </>
    );
  } else if (f.status === "revision_proposed" && approve) {
    title = "Approve the new wording";
    body = (
      <>
        <Textarea label="Note" hint="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Btn variant="danger" disabled={busy} onClick={() => run(() => decideRevision(f.id, false, note.trim() || undefined), "Revision rejected")}>
            Reject
          </Btn>
          <Btn
            variant="ink"
            disabled={busy}
            onClick={() => run(() => decideRevision(f.id, true, note.trim() || undefined), "Approved and published")}
          >
            Approve and publish
          </Btn>
        </div>
      </>
    );
  } else if (f.status === "approved") {
    title = "Check the fix";
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-mute">Re-scan every active document to confirm the conflict is gone.</p>
        <Btn variant="red" icon="refresh" disabled={busy} onClick={() => run(() => reverify(f.id), "Re-scan started")}>
          Re-scan
        </Btn>
      </div>
    );
  } else if (f.status === "rescanned" && review) {
    const resolved = f.reverified === "resolved";
    title = resolved ? "The re-scan no longer finds this conflict" : "The re-scan still finds this conflict";
    body = (
      <div className="flex flex-wrap justify-end gap-2">
        <Btn disabled={busy} onClick={() => run(() => setStatus(f.id, "detected"), "Reopened")}>
          Reopen
        </Btn>
        {resolved ? (
          <Btn variant="ink" disabled={busy} onClick={() => run(() => setStatus(f.id, "closed"), "Closed")}>
            Close finding
          </Btn>
        ) : (
          <Btn variant="ink" disabled={busy} onClick={() => setMode("close")}>
            Close anyway
          </Btn>
        )}
      </div>
    );
  } else if ((f.status === "closed" || f.status === "dismissed") && review) {
    title = f.status === "closed" ? "Closed" : "Dismissed";
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-mute">Reopen it if the conflict comes back.</p>
        <Btn disabled={busy} onClick={() => run(() => setStatus(f.id, "detected"), "Reopened")}>
          Reopen
        </Btn>
      </div>
    );
  }

  if (!body) return null;
  return (
    <section className="flex flex-col gap-3 rounded-[7px] border border-ink px-4 py-4">
      <h3 className="text-[14px] font-bold">{title}</h3>
      {body}
    </section>
  );
}

/* ---------- notes ---------- */

const NOTE_MAX = 280;

export function Notes({ f }: { f: Finding }) {
  const { addNote } = useWorkspace();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <h3 className="mb-3 text-[13px] font-bold">Notes</h3>
      {f.notes.length > 0 && (
        <ol className="mb-3 flex flex-col gap-2">
          {f.notes.map((n) => (
            <li key={n.id} className="rounded-[7px] border border-line px-4 py-3">
              <p className="text-[12px] text-mute">
                {n.by} · {fmtDateTime(n.at)}
              </p>
              <p className="mt-1 text-[14px] leading-[1.55] whitespace-pre-line">{n.text}</p>
            </li>
          ))}
        </ol>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await addNote(f.id, text.trim());
            setText("");
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {/* a fixed box: the limit keeps every note inside its four lines, so it never scrolls or grows */}
        <Textarea
          aria-label="Add a note"
          value={text}
          maxLength={NOTE_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note for the team"
          className="[&_textarea]:h-[108px] [&_textarea]:min-h-0 [&_textarea]:resize-none [&_textarea]:overflow-hidden"
        />
        <div className="flex items-center justify-between gap-3">
          <span className={`text-[12px] tabular-nums ${text.length >= NOTE_MAX ? "font-semibold text-red" : "text-mute"}`}>{NOTE_MAX - text.length} characters left</span>
          <Btn type="submit" disabled={busy || !text.trim()}>
            Add note
          </Btn>
        </div>
      </form>
    </section>
  );
}

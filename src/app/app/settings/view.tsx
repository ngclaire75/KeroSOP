"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Icon } from "@/components/app/icons";
import { AppLink, Avatar, Btn, Input, ListFooter, Modal, PageHeader, Select, fmtDate, orgName, useToast, usePaged } from "@/components/app/ui";
import { topicLabel } from "@/lib/app/labels";
import { useWorkspace } from "@/lib/app/store";
import { prefersReducedMotion } from "@/lib/random";
import { AUTHORITY_LABEL, ROLE_LABEL, type Authority, type Member, type Risk, type Role, type Settings } from "@/lib/app/types";
import { RiskSkyline } from "./RiskSkyline";

/* ---------- card parts ---------- */

const BTN = "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4.5 text-[14px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45";
/** Red is the main action, a white outline the second, as on Integrations. */
const BTN_MAIN = `${BTN} bg-red text-white hover:bg-red-deep`;
const BTN_LINE = `${BTN} border border-white text-white hover:bg-white hover:text-black`;
const FIELD =
  "h-11 w-full min-w-0 rounded-[9px] border border-white/15 bg-[#1f1f1f] px-3.5 text-[14px] text-white outline-none transition-colors placeholder:text-white/75 hover:border-white/50 focus:border-white disabled:cursor-not-allowed disabled:opacity-60";
/** The shared dropdown, recoloured for the black cards; its menu stays white. */
const SELECT_ON_DARK =
  "[&_[role=combobox]]:h-11 [&_[role=combobox]]:border-white/15 [&_[role=combobox]]:bg-[#1f1f1f] [&_[role=combobox]]:text-white [&_[role=combobox]:hover]:border-white/50 [&>div>svg]:text-white";
/** Rows inside the black cards: dark grey, separate, hairline border, 10px corners. */
const ROW = "rounded-[7px] border border-white/10 bg-[#1f1f1f] text-white";
/** A compact dark dropdown that sits inside a row. */
const SELECT_IN_ROW =
  "[&_[role=combobox]]:h-10 [&_[role=combobox]]:rounded-[6px] [&_[role=combobox]]:font-semibold [&_[role=combobox]]:border-white/15 [&_[role=combobox]]:bg-[#2b2b2b] [&_[role=combobox]]:text-white [&_[role=combobox]:hover]:border-white/60 [&>div>svg]:text-white";

const RETENTION = [
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "730", label: "2 years" },
  { value: "1095", label: "3 years" },
  { value: "2555", label: "7 years" },
];
const LANGUAGES = ["English", "中文"];
const RISKS: Risk[] = ["high", "medium", "low"];
/** Risk by topic pages at twelve, not the usual seven: two columns of six fill the card. */
const TOPICS_PER_PAGE = 12;
const RISK_LABEL: Record<Risk, string> = { high: "High", medium: "Medium", low: "Low" };
const INVITE_ROLES = (["admin", "editor", "reviewer", "approver", "viewer"] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** "Department SOP" → "department SOP": lower only the first letter, keep acronyms. */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Black card with white text, as on Integrations. Not overflow-hidden, so dropdown menus can open past the edge; focus-within lifts a card with an open menu above the ones after it. */
function DarkCard({ className = "", ...props }: ComponentProps<"section">) {
  return <section {...props} className={`relative rounded-[9px] border border-white/[0.08] bg-[#0b0b0b] text-white focus-within:z-20 ${className}`} />;
}

function CardHead({ title, hint, action }: { title: string; hint: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-[18px] font-semibold">{title}</h2>
        <p className="mt-1 max-w-[560px] text-[14px] leading-[1.55] text-white">{hint}</p>
      </div>
      {action}
    </header>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-white uppercase">{label}</dt>
      <dd className="mt-1 text-[18px] font-semibold whitespace-nowrap tabular-nums">{children}</dd>
    </div>
  );
}

/** Card actions, pinned to the bottom so cards in a row line up. `tight` follows content that is already pinned. */
function Foot({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return <div className={`${tight ? "" : "mt-auto "}flex flex-wrap items-center gap-2 pt-6`}>{children}</div>;
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-[13px] font-semibold text-white">{label}</span>
      {children}
    </label>
  );
}

function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange(v: boolean): void; label: string; hint: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-5 py-3.5 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="mt-0.5 block text-[13px] leading-[1.5] text-white">{hint}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white ${checked ? "bg-red" : "bg-white/25"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </label>
  );
}

/** White chips with a remove button, plus a field to add one. Used for departments and regions. */
function TagEditor({ items, onChange, placeholder, disabled, noun }: { items: string[]; onChange(v: string[]): void; placeholder: string; disabled: boolean; noun: string }) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLUListElement>(null);
  const clean = draft.trim();
  const dupe = items.some((i) => i.toLowerCase() === clean.toLowerCase());
  const add = () => {
    if (!clean || dupe) return;
    onChange([...items, clean]);
    setDraft("");
    // anime.js: the new chip settles in
    requestAnimationFrame(() => {
      const el = list.current?.lastElementChild as HTMLElement | null;
      if (!el || prefersReducedMotion()) return;
      import("animejs").then(({ animate }) => animate(el, { scale: [0.6, 1], opacity: [0, 1], duration: 380, ease: "outBack(1.6)", onComplete: () => el.style.removeProperty("transform") }));
    });
  };
  return (
    <div className="flex flex-col gap-4">
      {items.length ? (
        <ul ref={list} className="flex flex-wrap gap-2">
          {items.map((t) => (
            <li key={t} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-white pr-1.5 pl-3 text-[13px] font-semibold text-black">
              <span className="truncate">{t}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(items.filter((i) => i !== t))}
                aria-label={`Remove ${t}`}
                className="grid size-5 shrink-0 place-items-center rounded-full transition-colors hover:bg-red hover:text-white disabled:pointer-events-none"
              >
                <Icon name="x" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-white">No {noun} yet.</p>
      )}
      <div className="flex gap-2">
        <input
          className={FIELD}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={60}
        />
        {/* white with black text, square-cornered like the field beside it; dimmed until there is something to add */}
        <button type="button" disabled={disabled || !clean || dupe} onClick={add} className={`${BTN.replace("rounded-full", "rounded-[9px]")} h-11 shrink-0 bg-white text-black`}>
          Add
        </button>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function SettingsPage() {
  const { ws, me } = useWorkspace();
  const admin = me.role === "owner" || me.role === "admin";
  const grid = useRef<HTMLDivElement>(null);

  // anime.js: the cards rise in one after another on first load
  useEffect(() => {
    const el = grid.current;
    if (!el || prefersReducedMotion()) return;
    const cards = [...el.children] as HTMLElement[];
    import("animejs").then(({ animate, stagger }) =>
      animate(cards, {
        opacity: [0, 1],
        translateY: [18, 0],
        delay: stagger(70),
        duration: 620,
        ease: "outQuart",
        onComplete: () => cards.forEach((c) => c.style.removeProperty("transform")),
      }),
    );
  }, []);

  return (
    <>
      <PageHeader
        title="Settings"
        intro={
          <>
            Who works in {orgName(ws.settings.company)}, what they can do, and the rules every scan follows: which documents win, how risky each topic is and how long records are kept.
            {!admin && " Only owners and admins can change these."}
          </>
        }
      />
      {/* members, risk and authority are desktop-only; say so rather than leave people looking */}
      <p className="-mt-2 pb-5 text-[13px] leading-[1.5] text-mute lg:hidden">Members, risk by topic and document authority can be changed on a desktop.</p>
      <div ref={grid} className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-12">
        <WorkspaceCard admin={admin} />
        <ReviewCard admin={admin} />
        <MembersCard admin={admin} />
        <RiskCard admin={admin} />
        <AuthorityCard admin={admin} />
        <ListCard admin={admin} field="departments" title="Departments" hint="Used to tag documents and members, and to filter findings." noun="departments" placeholder="Add a department" />
        <ListCard admin={admin} field="regions" title="Regions" hint="Where documents apply. Scans only compare rules whose regions overlap." noun="regions" placeholder="Add a region" />
      </div>
    </>
  );
}

/** Save one slice of settings, with a toast either way. */
function useSave() {
  const { updateSettings } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (patch: Partial<Settings>, done = "Saved") => {
    setBusy(true);
    try {
      await updateSettings(patch);
      toast(done);
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

/* ---------- workspace ---------- */

function WorkspaceCard({ admin }: { admin: boolean }) {
  const { ws } = useWorkspace();
  const s = ws.settings;
  const { busy, save } = useSave();
  const [company, setCompany] = useState(orgName(s.company));
  const [retention, setRetention] = useState(String(s.retentionDays));
  const [langs, setLangs] = useState(s.languages);
  const draft = { company: company.trim(), retentionDays: Number(retention), languages: LANGUAGES.filter((l) => langs.includes(l)) };
  const dirty = !same(draft, { company: orgName(s.company), retentionDays: s.retentionDays, languages: LANGUAGES.filter((l) => s.languages.includes(l)) });
  const retentionOptions = RETENTION.some((r) => r.value === String(s.retentionDays)) ? RETENTION : [...RETENTION, { value: String(s.retentionDays), label: `${s.retentionDays} days` }];

  return (
    <DarkCard className="flex flex-col p-5 sm:p-7 xl:col-span-7">
      <CardHead title="Workspace" hint="The name on reports and exports, the languages your documents are written in, and how long audit records are kept." />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <FieldLabel label="Company name">
          <input className={FIELD} value={company} disabled={!admin} onChange={(e) => setCompany(e.target.value)} maxLength={80} />
        </FieldLabel>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[13px] font-semibold text-white">Keep records for</span>
          <Select aria-label="Keep records for" value={retention} disabled={!admin} onChange={(e) => setRetention(e.target.value)} options={retentionOptions} className={SELECT_ON_DARK} />
        </div>
      </div>
      <div className="mt-5">
        <p className="text-[13px] font-semibold">Document languages</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => {
            const on = langs.includes(l);
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                disabled={!admin || (on && langs.length === 1)}
                onClick={() => setLangs(on ? langs.filter((x) => x !== l) : [...langs, l])}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${on ? "bg-white text-black" : "border border-white text-white hover:bg-white hover:text-black"}`}
              >
                {on && <Icon name="check" className="size-3.5" />}
                {l}
              </button>
            );
          })}
        </div>
      </div>
      <dl className="mt-auto flex flex-wrap gap-x-6 gap-y-4 pt-8 sm:gap-x-10">
        <Fact label="Created">{fmtDate(ws.createdAt)}</Fact>
        <Fact label="Members">{ws.members.length}</Fact>
        <Fact label="Documents">{ws.docs.length}</Fact>
      </dl>
      <Foot tight>
        <button type="button" disabled={!admin || busy || !dirty || !draft.company} onClick={() => save(draft)} className={BTN_MAIN}>
          Save changes
        </button>
        {dirty && (
          <button type="button" onClick={() => (setCompany(orgName(s.company)), setRetention(String(s.retentionDays)), setLangs(s.languages))} className={BTN_LINE}>
            Discard
          </button>
        )}
      </Foot>
    </DarkCard>
  );
}

/* ---------- review rules and notifications ---------- */

function ReviewCard({ admin }: { admin: boolean }) {
  const { ws } = useWorkspace();
  const s = ws.settings;
  const { busy, save } = useSave();
  const flip = (key: "separationOfDuties" | "notifyEmail" | "notifyAssigned" | "notifyScans", label: string) => (v: boolean) =>
    save({ [key]: v }, `${label} ${v ? "on" : "off"}`);
  return (
    <DarkCard className="flex flex-col p-5 sm:p-7 xl:col-span-5">
      <CardHead title="Review and alerts" hint="Changes here apply straight away." />
      <div className="mt-3 flex flex-col">
        <Switch
          label="Separation of duties"
          hint="A revision can't be approved by the person who proposed it."
          checked={!!s.separationOfDuties}
          disabled={!admin || busy}
          onChange={flip("separationOfDuties", "Separation of duties")}
        />
        <Switch label="Email digests" hint="A daily email of new findings and decisions." checked={s.notifyEmail} disabled={!admin || busy} onChange={flip("notifyEmail", "Email digests")} />
        <Switch label="When I'm assigned" hint="Tell people as soon as a finding is assigned to them." checked={s.notifyAssigned} disabled={!admin || busy} onChange={flip("notifyAssigned", "Assignment alerts")} />
        <Switch label="When a scan finishes" hint="Tell whoever started it, with the number of new findings." checked={s.notifyScans} disabled={!admin || busy} onChange={flip("notifyScans", "Scan alerts")} />
      </div>
      <Foot>
        <p className="text-[13px] leading-[1.5]">
          Alerts to Slack, n8n, Zapier or Make are set up in{" "}
          <AppLink href="/integrations" className="font-semibold underline decoration-white/50 underline-offset-4 hover:decoration-white">
            Integrations
          </AppLink>
          .
        </p>
      </Foot>
    </DarkCard>
  );
}

/* ---------- members ---------- */

/** Member, department, role, remove. Narrower side columns below xl leave room for the email. */
const MEMBER_COLS = "md:grid md:grid-cols-[minmax(0,1fr)_132px_176px_36px] md:items-center md:gap-x-4 xl:grid-cols-[minmax(0,1fr)_200px_200px_36px] xl:gap-x-5";

function MembersCard({ admin }: { admin: boolean }) {
  const { ws, me, setRole, removeMember } = useWorkspace();
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const members = useMemo(
    () => [...ws.members].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner") || Number(!!a.invited) - Number(!!b.invited) || a.name.localeCompare(b.name)),
    [ws.members],
  );
  const paged = usePaged(members);
  const run = async (p: Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await p;
      toast(done);
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <DarkCard className="hidden flex-col p-5 sm:p-7 lg:flex xl:col-span-12">
      <CardHead
        title="Members"
        hint="Roles decide who can upload documents, review findings and approve revisions. People without an account get access when they first sign in with this email."
        action={
          admin && (
            <button type="button" onClick={() => setInviting(true)} className={BTN_MAIN}>
              <Icon name="plus" className="size-4" />
              Invite member
            </button>
          )
        }
      />

      <div className={`mt-6 hidden pr-4 pb-2.5 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-white uppercase ${MEMBER_COLS}`}>
        <span>Member</span>
        <span>Department</span>
        <span>Role</span>
        <span />
      </div>
      <ul className="mt-6 flex flex-col gap-2 md:mt-0">
        {paged.items.map((m) => {
          const self = m.email.toLowerCase() === me.email.toLowerCase();
          const owner = m.role === "owner";
          return (
            <li key={m.id} className={`${ROW} flex flex-col gap-3 px-4 py-3.5 md:min-h-[68px] md:py-2.5 ${MEMBER_COLS}`}>
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={m.name} size={32} />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">{m.name}</span>
                    {self && <span className="shrink-0 text-[12px] font-semibold text-red">You</span>}
                  </span>
                  <span className="block truncate text-[12px] text-white/75">
                    {m.email}
                    {m.invited && <span className="hidden xl:inline"> · Not signed in yet</span>}
                  </span>
                  {/* below xl the status gets its own line, so a long email can't push it out of view */}
                  {m.invited && <span className="block text-[12px] text-white/75 xl:hidden">Not signed in yet</span>}
                </span>
              </span>
              <span className="truncate text-[13px] text-white">
                <span className="md:hidden">Department: </span>
                {m.department || "—"}
              </span>
              {owner || !admin || self ? (
                <span className="flex h-10 items-center text-[13px] font-semibold">{ROLE_LABEL[m.role]}</span>
              ) : (
                <Select
                  aria-label={`Role for ${m.name}`}
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => run(setRole(m.id, e.target.value as Role), `${m.name} is now ${ROLE_LABEL[e.target.value as Role].toLowerCase()}`)}
                  options={INVITE_ROLES}
                  className={SELECT_IN_ROW}
                />
              )}
              <span className="flex md:justify-end">
                {admin && !owner && !self && (
                  <button
                    type="button"
                    onClick={() => setRemoving(m)}
                    aria-label={`Remove ${m.name}`}
                    className="inline-flex h-9 items-center gap-2 text-[13px] font-semibold text-white transition-colors hover:text-red md:size-9 md:justify-center"
                  >
                    <Icon name="trash" className="size-4" />
                    <span className="md:hidden">Remove</span>
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {/* the shared pager; on the black card its text is white and turns red on hover */}
      <ListFooter paged={paged} className="text-white [&_button:hover]:text-red" />

      <InviteModal open={inviting} onClose={() => setInviting(false)} />
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        footer={
          <>
            <Btn onClick={() => setRemoving(null)}>Cancel</Btn>
            <Btn
              variant="red"
              disabled={busy}
              onClick={async () => {
                if (removing && (await run(removeMember(removing.id), `${removing.name} removed`))) setRemoving(null);
              }}
            >
              Remove
            </Btn>
          </>
        }
      >
        <p className="text-[14px] leading-[1.55] text-mute">
          They lose access to this workspace straight away. Their past decisions stay in Audit History.
        </p>
      </Modal>
    </DarkCard>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose(): void }) {
  const { ws, invite } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRoleValue] = useState<Role>("reviewer");
  const [dept, setDept] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const close = () => {
    setName("");
    setEmail("");
    setRoleValue("reviewer");
    setDept("");
    onClose();
  };
  const send = async () => {
    setBusy(true);
    try {
      await invite({ name: name.trim(), email: email.trim(), role, department: dept });
      toast(`${name.trim()} can now sign in`);
      close();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Invite a member"
      footer={
        <>
          <Btn onClick={close}>Cancel</Btn>
          <Btn variant="red" disabled={!valid || busy} onClick={send}>
            Give access
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grace Tan" maxLength={80} />
        <Input label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="grace@company.com" />
        <Select label="Role" value={role} onChange={(e) => setRoleValue(e.target.value as Role)} options={INVITE_ROLES} />
        <Select label="Department" value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: "", label: "No department" }, ...ws.settings.departments.map((d) => ({ value: d, label: d }))]} />
      </div>
    </Modal>
  );
}

/* ---------- risk by topic ---------- */

function RiskCard({ admin }: { admin: boolean }) {
  const { ws } = useWorkspace();
  const s = ws.settings;
  const { busy, save } = useSave();
  const topics = useMemo(
    () => [...new Set([...Object.keys(s.topicRisk), ...ws.rules.map((r) => r.topic)])].filter((t) => t !== "general").sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))),
    [s.topicRisk, ws.rules],
  );
  const [draft, setDraft] = useState<Record<string, Risk>>(() => Object.fromEntries(topics.map((t) => [t, s.topicRisk[t] ?? "medium"])));
  const [hover, setHover] = useState(-1);
  // twelve topics a page (two columns of six); the skyline shows the same page as the list
  const paged = usePaged(topics, TOPICS_PER_PAGE);
  const saved = Object.fromEntries(topics.map((t) => [t, s.topicRisk[t] ?? "medium"]));
  const dirty = !same(draft, saved);
  const high = topics.filter((t) => draft[t] === "high").length;

  return (
    <DarkCard className="hidden flex-col p-5 sm:p-7 lg:flex xl:col-span-7">
      <CardHead title="Risk by topic" hint={`New findings take the risk of their topic. ${high} of ${topics.length} topics are high risk.`} />
      {/* p5: one column per topic, in the order of the list below */}
      <div className="relative mt-6 h-[72px]">
        <RiskSkyline risks={paged.items.map((t) => draft[t] ?? "medium")} hover={hover} />
      </div>
      <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2" onPointerLeave={() => setHover(-1)}>
        {paged.items.map((t, i) => (
          <li key={t} onPointerEnter={() => setHover(i)} className={`${ROW} flex h-14 items-center justify-between gap-3 pr-2 pl-4`}>
            <span className="min-w-0 truncate text-[14px] font-semibold">{topicLabel(t)}</span>
            <Select
              aria-label={`Risk for ${topicLabel(t)}`}
              value={draft[t] ?? "medium"}
              disabled={!admin}
              onChange={(e) => setDraft({ ...draft, [t]: e.target.value as Risk })}
              options={RISKS.map((r) => ({ value: r, label: RISK_LABEL[r] }))}
              className={`w-[124px] shrink-0 ${SELECT_IN_ROW}`}
            />
          </li>
        ))}
      </ul>
      <ListFooter paged={paged} className="text-white [&_button:hover]:text-red" />
      <Foot>
        <button type="button" disabled={!admin || busy || !dirty} onClick={() => save({ topicRisk: draft })} className={BTN_MAIN}>
          Save changes
        </button>
        {dirty && (
          <button type="button" onClick={() => setDraft(saved)} className={BTN_LINE}>
            Discard
          </button>
        )}
      </Foot>
    </DarkCard>
  );
}

/* ---------- authority order ---------- */

function AuthorityCard({ admin }: { admin: boolean }) {
  const { ws } = useWorkspace();
  const s = ws.settings;
  const { busy, save } = useSave();
  const [order, setOrder] = useState<Authority[]>(s.hierarchy);
  const dirty = !same(order, s.hierarchy);
  const list = useRef<HTMLOListElement>(null);
  const move = (i: number, by: number) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    setOrder(next);
    // anime.js: the two rows that swapped slide into their new places
    const rows = list.current?.children;
    const a = rows?.[i] as HTMLElement | undefined;
    const b = rows?.[i + by] as HTMLElement | undefined;
    if (!a || !b || prefersReducedMotion()) return;
    const d = b.offsetTop - a.offsetTop;
    import("animejs").then(({ animate }) => {
      animate(a, { translateY: [d, 0], duration: 360, ease: "outQuart", onComplete: () => a.style.removeProperty("transform") });
      animate(b, { translateY: [-d, 0], duration: 360, ease: "outQuart", onComplete: () => b.style.removeProperty("transform") });
    });
  };
  const step = "grid size-9 place-items-center rounded-full text-white transition-colors hover:text-red disabled:pointer-events-none disabled:opacity-30";

  return (
    <DarkCard className="hidden flex-col p-5 sm:p-7 lg:flex xl:col-span-5">
      <CardHead title="Which document wins" hint="When two documents disagree, the one higher in this list is treated as the authority." />
      <ol ref={list} className="mt-6 flex flex-col gap-2">
        {order.map((a, i) => (
          <li key={a} className={`${ROW} flex h-14 items-center gap-3 pr-2 pl-4`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{AUTHORITY_LABEL[a]}</span>
            </span>
            {(i === 0 || i === order.length - 1) && <span className="shrink-0 text-[14px] font-semibold text-white">{i === 0 ? "Highest" : "Lowest"}</span>}
            <span className="flex shrink-0">
              <button type="button" className={step} disabled={!admin || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${AUTHORITY_LABEL[a]} up`}>
                <Icon name="down" className="size-4 rotate-180" />
              </button>
              <button type="button" className={step} disabled={!admin || i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${AUTHORITY_LABEL[a]} down`}>
                <Icon name="down" className="size-4" />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-[13px] leading-[1.55]">
        For example, if a {lower(AUTHORITY_LABEL[order[1] ?? order[0]])} allows 14 days and a {lower(AUTHORITY_LABEL[order[0]])} allows 7, the finding names the{" "}
        {lower(AUTHORITY_LABEL[order[0]])} as the rule to follow.
      </p>
      <Foot>
        <button type="button" disabled={!admin || busy || !dirty} onClick={() => save({ hierarchy: order })} className={BTN_MAIN}>
          Save order
        </button>
        {dirty && (
          <button type="button" onClick={() => setOrder(s.hierarchy)} className={BTN_LINE}>
            Discard
          </button>
        )}
      </Foot>
    </DarkCard>
  );
}

/* ---------- departments and regions ---------- */

function ListCard({ admin, field, title, hint, noun, placeholder }: { admin: boolean; field: "departments" | "regions"; title: string; hint: string; noun: string; placeholder: string }) {
  const { ws } = useWorkspace();
  const saved = ws.settings[field];
  const { busy, save } = useSave();
  const [items, setItems] = useState(saved);
  const dirty = !same(items, saved);
  return (
    <DarkCard className="flex flex-col p-5 sm:p-7 xl:col-span-6">
      <CardHead title={title} hint={hint} />
      <div className="mt-6">
        <TagEditor items={items} onChange={setItems} placeholder={placeholder} disabled={!admin} noun={noun} />
      </div>
      <Foot>
        <button type="button" disabled={!admin || busy || !dirty} onClick={() => save({ [field]: items })} className={BTN_MAIN}>
          Save changes
        </button>
        {dirty && (
          <button type="button" onClick={() => setItems(saved)} className={BTN_LINE}>
            Discard
          </button>
        )}
      </Foot>
    </DarkCard>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/ui";
import { logOut } from "@/lib/auth";
import { NAV, appHref, appPath, isAppPageEnabled, useAuthUser, type AuthUser } from "@/lib/app/nav";
import { api, setOrg } from "@/lib/app/api";
import { WorkspaceProvider, useWorkspace } from "@/lib/app/store";
import { STATUS_LABEL, TYPE_LABEL, type Me, type Risk, type Status } from "@/lib/app/types";
import { Icon } from "./icons";
import { AppLink, RiskBadge, ToastHost, btnClass } from "./ui";

/* ---------- root: auth gate → workspace → shell ---------- */

function Splash({ text = "Loading your workspace" }: { text?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f5f6f8]">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-12 w-auto animate-pulse" />
        <p className="text-[14px] text-mute">{text}…</p>
      </div>
    </div>
  );
}

export function AppRoot({ children }: { children: ReactNode }) {
  const user = useAuthUser();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user === null) {
      const here = window.location.pathname + window.location.search;
      window.location.replace(`/login?next=${encodeURIComponent(here)}`);
    }
    if (!user) return;
    api<Me>("/v1/me")
      .then(async (m) => {
        if (m.orgs.length) return setMe(m);
        // a KeroSOP administrator without a workspace of their own opens the demo one
        if (m.isAdmin) {
          const { organization } = await api<{ organization: string }>("/v1/admin/demo", { method: "POST" });
          setOrg(organization);
          return setMe(await api<Me>("/v1/me"));
        }
        // everyone else books a demo first, which opens their workspace
        window.location.replace("/request-access");
      })
      .catch((e) => setError((e as Error).message));
  }, [user]);
  if (error) return <Problem text={error} />;
  if (!user || !me) return <Splash text={user === null ? "Taking you to log in" : "Opening your workspace"} />;
  return (
    <ToastHost>
      <WorkspaceProvider meInfo={me} fallback={<Splash />} onError={(t) => <Problem text={t} />}>
        <Shell user={user}>{children}</Shell>
      </WorkspaceProvider>
    </ToastHost>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f5f6f8] px-6">
      <div className="max-w-[420px] text-center">
        <LogoMark className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-[20px] font-bold">The dashboard could not load</h1>
        <p className="mt-2 text-[15px] leading-[1.55] text-mute">{text}</p>
        <button type="button" onClick={() => window.location.reload()} className={`${btnClass("ink")} mt-6`}>
          Try again
        </button>
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

function useCounts() {
  const { ws, running } = useWorkspace();
  return {
    "/findings": ws.findings.filter((f) => ["detected", "under_review"].includes(f.status)).length,
    "/resolution": ws.findings.filter((f) => ["confirmed", "assigned", "revision_proposed", "approved", "rejected", "rescanned"].includes(f.status)).length,
    "/scans": running.length,
  } as Record<string, number>;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = appPath(usePathname() ?? "/");
  const counts = useCounts();
  const { running } = useWorkspace();
  const groups = NAV;
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.label || "top"}>
          {g.label && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.12em] text-paper/35 uppercase">
              {g.label}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const active = it.href === "/" ? path === "/" : path === it.href || path.startsWith(it.href + "/");
              const n = isAppPageEnabled(it.href) ? counts[it.href] : 0;
              return (
                <li key={it.href}>
                  <AppLink
                    href={it.href}
                    onClick={onNavigate}
                    title={it.hint}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-10 items-center gap-3 rounded-[12px] border px-3 text-[14px] font-medium transition-colors ${
                      active ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] text-paper" : isAppPageEnabled(it.href) ? "border-transparent text-paper/60 hover:text-paper" : "border-transparent text-paper/25"
                    }`}
                  >
                    <Icon name={it.icon} className="size-[18px]" />
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.href === "/scans" && running.length > 0 ? (
                      <span className="text-[11px] font-semibold text-red" aria-label="Scan running">Running</span>
                    ) : n ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-paper px-1.5 text-[11px] font-bold text-ink">{n}</span>
                    ) : null}
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  return (
    <div className="on-dark flex h-full w-full flex-col bg-[#0b0b0b] text-paper">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <span className="grid size-9 place-items-center rounded-[10px] bg-red">
          <LogoMark tone="paper" className="h-6 w-auto" />
        </span>
        <p className="text-[19px] leading-tight font-semibold">KeroSOP</p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" className="fixed top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-white sm:right-4">
            <span className="relative block h-3 w-5" aria-hidden="true">
              <span className="absolute top-[5px] left-0 h-[2px] w-5 rotate-45 bg-current" />
              <span className="absolute top-[5px] left-0 h-[2px] w-5 -rotate-45 bg-current" />
            </span>
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
        <NavList onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/* ---------- command palette (⌘K) ---------- */

type Scope = "all" | "findings" | "documents" | "rules" | "pages";
type Cmd = { id: string; label: string; sub?: string; icon: string; href: string; scope: Exclude<Scope, "all">; group: string; text: string; risk?: Risk; status?: Status; meta?: string };

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "findings", label: "Findings" },
  { id: "documents", label: "Documents" },
  { id: "rules", label: "Rules" },
  { id: "pages", label: "Pages" },
];

/** The matched part of a label in bold, the rest as is. */
function Match({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-red/10 px-px text-ink">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

function Palette({ open, onClose }: { open: boolean; onClose(): void }) {
  const { ws } = useWorkspace();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [i, setI] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const all = useMemo<Cmd[]>(() => {
    const actions: Cmd[] = [
      { id: "a-upload", label: "Upload documents", icon: "upload", href: "/documents?upload=1", scope: "pages", group: "Quick actions", text: "upload documents" },
      { id: "a-scan", label: "Run a scan", icon: "scan", href: "/scans?new=1", scope: "pages", group: "Quick actions", text: "run scan" },
      { id: "a-report", label: "Export audit report", icon: "report", href: "/reports", scope: "pages", group: "Quick actions", text: "export audit report pdf csv" },
      { id: "a-import", label: "Import from GitHub or a URL", icon: "github", href: "/integrations", scope: "pages", group: "Quick actions", text: "import github url" },
    ];
    const pages: Cmd[] = NAV.flatMap((g) => g.items).map((it) => ({ id: it.href, label: it.label, sub: it.hint, icon: it.icon, href: it.href, scope: "pages", group: "Pages", text: `${it.label} ${it.hint}` }));
    const rank = (f: { risk: Risk }) => ["high", "medium", "low"].indexOf(f.risk);
    const findings: Cmd[] = [...ws.findings]
      .sort((a, b) => Number(b.status !== "closed" && b.status !== "dismissed") - Number(a.status !== "closed" && a.status !== "dismissed") || rank(a) - rank(b))
      .map((f) => ({ id: f.id, label: f.title, sub: `${f.id} · ${TYPE_LABEL[f.type]}${f.department ? ` · ${f.department}` : ""}`, icon: "alert", href: `/findings/${f.id}`, scope: "findings", group: "Findings", text: `${f.id} ${f.title} ${f.explanation} ${f.department}`, risk: f.risk, status: f.status }));
    const docs: Cmd[] = ws.docs.map((d) => ({ id: d.id, label: d.title, sub: `${d.fileName} · ${d.department || "No department"}`, icon: "doc", href: `/documents?doc=${d.id}`, scope: "documents", group: "Documents", text: `${d.title} ${d.fileName} ${d.department}`, meta: `v${d.versions[d.current]?.version ?? "—"}` }));
    const rules: Cmd[] = ws.rules
      .filter((r) => !r.historical)
      .map((r) => ({ id: r.id, label: r.quote, sub: `${r.id} · §${r.sectionRef} · p. ${r.page}`, icon: "rules", href: `/rules?rule=${r.id}`, scope: "rules", group: "Rules", text: `${r.id} ${r.quote}` }));
    return [...actions, ...findings, ...docs, ...rules, ...pages].filter((c) => isAppPageEnabled(c.href));
  }, [ws]);

  const term = q.trim().toLowerCase();
  const results = useMemo(() => {
    const inScope = all.filter((c) => (scope === "all" ? true : c.scope === scope && c.group !== "Quick actions"));
    if (term) return inScope.filter((c) => c.text.toLowerCase().includes(term)).slice(0, 50);
    // nothing typed: actions, the most pressing findings, then pages
    if (scope === "all") return [...inScope.filter((c) => c.group === "Quick actions"), ...inScope.filter((c) => c.group === "Findings").slice(0, 5), ...inScope.filter((c) => c.group === "Pages")];
    return inScope.slice(0, 50);
  }, [all, scope, term]);
  const counts = useMemo(() => {
    const m = all.filter((c) => c.group !== "Quick actions" && (!term || c.text.toLowerCase().includes(term)));
    return Object.fromEntries(SCOPES.map((s) => [s.id, s.id === "all" ? m.length : m.filter((c) => c.scope === s.id).length]));
  }, [all, term]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // keep the highlighted row in view while moving with the keyboard
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }, [i]);

  if (!open) return null;
  const close = () => {
    onClose();
    setQ("");
    setScope("all");
    setI(0);
  };
  const go = (c: Cmd) => {
    close();
    router.push(appHref(c.href));
  };
  const cycle = (dir: 1 | -1) => {
    const k = SCOPES.findIndex((s) => s.id === scope);
    setScope(SCOPES[(k + dir + SCOPES.length) % SCOPES.length].id);
    setI(0);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center bg-ink/30 px-3 pt-[10vh] backdrop-blur-[3px] sm:px-4" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="flex max-h-[76vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[20px] bg-paper shadow-[0_24px_80px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3 px-5">
          <Icon name="search" className="size-5 text-mute" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Tab") {
                e.preventDefault();
                cycle(e.shiftKey ? -1 : 1);
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((x) => Math.min(results.length - 1, x + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              }
              if (e.key === "Enter" && results[i]) go(results[i]);
            }}
            placeholder="Search findings, documents, rules and pages"
            aria-label="Search"
            aria-controls="palette-results"
            aria-activedescendant={results[i] ? `pal-${i}` : undefined}
            className="quiet-focus h-[60px] min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-mute/80 focus-visible:outline-none"
          />
          {q && (
            <button type="button" onClick={() => (setQ(""), setI(0))} className="rounded-full px-2 py-1 text-[12px] font-semibold text-mute hover:text-ink">
              Clear
            </button>
          )}
          <button type="button" onClick={close} className="hidden h-6 items-center rounded-[6px] border border-line px-1.5 text-[11px] font-semibold text-mute hover:text-ink sm:inline-flex">
            Esc
          </button>
        </div>

        <div role="tablist" aria-label="Search in" className="flex gap-1 overflow-x-auto border-y border-line px-3 py-2">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scope === s.id}
              onClick={() => (setScope(s.id), setI(0))}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors ${scope === s.id ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
            >
              {s.label}
              <span className={`text-[11px] tabular-nums ${scope === s.id ? "text-paper/60" : "text-mute/70"}`}>{counts[s.id]}</span>
            </button>
          ))}
        </div>

        <ul ref={list} id="palette-results" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {results.length === 0 && (
            <li className="flex flex-col items-center px-6 py-14 text-center">
              <p className="text-[15px] font-semibold">Nothing matches “{q}”</p>
              <p className="mt-1 text-[13px] text-mute">{scope === "all" ? "Try a finding ID such as SOP-004, or part of a clause." : "Try searching everything instead."}</p>
              {scope !== "all" && (
                <button type="button" onClick={() => setScope("all")} className="mt-4 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold hover:border-ink/40">
                  Search everything
                </button>
              )}
            </li>
          )}
          {results.map((c, idx) => (
            <li key={c.group + c.id} id={`pal-${idx}`} role="option" aria-selected={idx === i} data-idx={idx}>
              {(idx === 0 || results[idx - 1].group !== c.group) && <p className="px-3 pt-4 pb-1.5 text-[12px] font-semibold text-mute">{c.group}</p>}
              <button
                type="button"
                tabIndex={-1}
                onMouseMove={() => idx !== i && setI(idx)}
                onClick={() => go(c)}
                className={`grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] px-3 py-2 text-left ${idx === i ? "ring-1 ring-ink/15 ring-inset" : ""}`}
              >
                <span className={`grid size-8 place-items-center rounded-[9px] ${idx === i ? "bg-ink text-paper" : "bg-fog"}`}>
                  <Icon name={c.icon} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">
                    <Match text={c.label} q={term} />
                  </span>
                  {c.sub && (
                    <span className="mt-0.5 block truncate text-[12px] text-mute">
                      <Match text={c.sub} q={term} />
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {c.status && <span className="hidden text-[12px] text-mute sm:inline">{STATUS_LABEL[c.status]}</span>}
                  {c.risk && <RiskBadge risk={c.risk} />}
                  {c.meta && <span className="font-mono text-[12px] text-mute">{c.meta}</span>}
                  {idx === i && !c.risk && !c.meta && <Icon name="arrow" className="size-4 text-mute" />}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-4 border-t border-line bg-[#fafaf9] px-5 py-2.5 text-[12px] text-mute sm:flex">
          {[
            ["↑ ↓", "move"],
            ["↵", "open"],
            ["Tab", "change scope"],
          ].map(([k, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-paper px-1 font-sans text-[11px] font-semibold text-ink">{k}</kbd>
              {l}
            </span>
          ))}
          <span className="ml-auto tabular-nums">
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- layout ---------- */

function Shell({ children }: { user: AuthUser; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const mobileMenu = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menu) return;
    const trigger = menuTrigger.current;
    const wide = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (wide.matches) setMenu(false); };
    wide.addEventListener("change", closeOnDesktop);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileMenu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      wide.removeEventListener("change", closeOnDesktop);
      trigger?.focus();
    };
  }, [menu]);

  // no visible scrollbars anywhere in the dashboard (see globals.css); scrolling itself is untouched
  useEffect(() => {
    document.documentElement.classList.add("no-scrollbars");
    return () => document.documentElement.classList.remove("no-scrollbars");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-[#0b0b0b] lg:pl-[264px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">
        <Sidebar />
      </aside>

      {menu && (
        <div ref={mobileMenu} role="dialog" aria-modal="true" aria-label="Dashboard menu" className="fixed inset-0 z-[60] h-dvh w-full bg-[#0b0b0b] text-white lg:hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(false);
            if (e.key !== "Tab") return;
            const controls = mobileMenu.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled)');
            if (!controls?.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }}>
          <Sidebar onNavigate={() => setMenu(false)} onClose={() => setMenu(false)} />
        </div>
      )}

      <header className="sticky top-0 z-30 bg-[#0b0b0b]/90 text-paper backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 px-3 sm:px-4 lg:pr-5 lg:pl-1">
          <button ref={menuTrigger} type="button" aria-expanded={menu} onClick={() => setMenu(true)} className="order-last inline-flex size-11 items-center justify-center rounded-full lg:hidden" aria-label="Open menu">
            <span className="relative block h-3 w-5" aria-hidden="true">
              <span className="absolute top-0 left-0 h-[2px] w-5 bg-current" />
              <span className="absolute top-[10px] left-0 h-[2px] w-5 bg-current" />
            </span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => logOut().then(() => window.location.assign("/login"))}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-[14px] font-semibold text-paper transition-colors hover:border-white/40"
            >
              <Icon name="out" className="size-4" />
              Log out
            </button>
            <AppLink href="/scans?new=1" className="hidden h-10 items-center rounded-full bg-red px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-red-deep sm:inline-flex">
              Run a scan
            </AppLink>
          </div>
        </div>
      </header>

      <div className="px-2 pb-2 sm:px-3 sm:pb-3 lg:pl-0">
        <main className="min-h-[calc(100dvh-76px)] rounded-[16px] bg-[#f5f6f8]">
          <div className="mx-auto max-w-[1400px] px-4 pt-10 pb-16 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}

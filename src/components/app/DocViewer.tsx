"use client";

/**
 * The original Word or PDF file, open in place: pdf.js draws PDF pages to
 * canvas, docx-preview lays .docx out as Word pages. A page fills the column
 * at its natural size (no viewer box, no inner scroll) and one page shows at
 * a time from page 1, with the quoted wording highlighted on its page. Sample
 * documents get real files built by the API.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FileLogo } from "./FileLogo";
import { Icon } from "./icons";
import { download, fetchFile } from "@/lib/app/api";
import { prefersReducedMotion } from "@/lib/random";
import type { Doc, Evidence } from "@/lib/app/types";

const MARK = "rgba(227, 6, 19, 0.24)";
const A4 = 297 / 210;
const strip = (s: string) => s.replace(/\s+/g, "");

type Props = { doc: Doc; evidence: Evidence; label: string };

export function DocViewer({ doc, evidence, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [cited, setCited] = useState(evidence.page || 1);
  const [width, setWidth] = useState(0);
  const isPdf = doc.kind !== "docx";
  const path = `/v1/documents/${doc.id}/versions/${evidence.version}/file`;

  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      setBlob(null);
      setError("");
      setPages(0);
    });
    fetchFile(path)
      .then((b) => live && setBlob(b))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [path]);

  // pages fit the column; lay them out again only when its width really changes
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth((w) =>
        Math.abs(w - e.contentRect.width) > 8
          ? Math.round(e.contentRect.width)
          : w,
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [pageH, setPageH] = useState(0);
  /** Scroll the document view so page n sits at the top. */
  const scrollTo = useCallback((n: number, smooth = true) => {
    const box = host.current;
    const count = box?.querySelectorAll("[data-page]").length ?? 0;
    if (!box || !count) return;
    // pages are evenly spaced, so page n starts n-1 steps down; no zoomed measurements, which Safari reports differently
    box.scrollTo({
      top: Math.round(((n - 1) * box.scrollHeight) / count),
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "instant",
    });
  }, []);

  // whenever the page size changes (resize, rotation), line the current page up again so it is never cut off
  useEffect(() => {
    if (pageH) requestAnimationFrame(() => scrollTo(page, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the size changes; paging scrolls on its own
  }, [pageH, scrollTo]);

  const pulse = useCallback(() => {
    const marks =
      host.current?.querySelectorAll<HTMLElement>("[data-kero-mark]");
    if (!marks?.length || prefersReducedMotion()) return;
    import("animejs").then(({ animate }) =>
      animate(marks, {
        opacity: [0.35, 1, 0.55, 1],
        duration: 1200,
        delay: 250,
        ease: "inOutSine",
      }),
    );
  }, []);

  const onRendered = useCallback(
    (count: number, markedPage: number | null) => {
      const at = markedPage ?? Math.min(evidence.page || 1, count);
      setPages(count);
      setCited(at);
      setPage(1);
      // the view is exactly one page tall; it opens on page 1, and "Cited page" jumps to the clause
      requestAnimationFrame(() => {
        const first = host.current?.querySelector<HTMLElement>("[data-page]");
        // every page is the same size with a 16px gap after it, so one page is the scroll height shared out, less
        // the gap; this reads the same in every browser, whatever each does with CSS zoom on Word pages
        const box = host.current;
        if (box) setPageH(first ? Math.round(box.scrollHeight / count - 16) : Math.round(box.clientWidth * A4));
        requestAnimationFrame(() => scrollTo(1, false));
      });
    },
    [evidence.page, scrollTo],
  );

  // the ‹ › buttons switch straight to the whole page, top aligned, without scrolling through
  const go = (n: number) => {
    const next = Math.max(1, Math.min(pages, n));
    setPage(next);
    scrollTo(next, false);
  };
  const btn =
    "grid size-8 place-items-center rounded-[8px] border border-line bg-paper text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <header className="flex h-8 items-center gap-2.5">
        <FileLogo kind={doc.kind} whitePage className="size-7 shrink-0" />
        {/* one line on every screen: a short code, the full file name on hover */}
        <p
          title={`${doc.fileName} · ${doc.title}`}
          className="min-w-0 flex-1 truncate text-[13px] font-semibold whitespace-nowrap tabular-nums"
        >
          {label}
        </p>
        {pages > 0 && page !== cited && (
          <button
            type="button"
            onClick={() => (go(cited), window.setTimeout(pulse, 450))}
            className="hidden h-8 shrink-0 text-[13px] font-semibold text-red sm:block"
          >
            Cited page
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {!error && (
            <>
              <button
                type="button"
                className={btn}
                aria-label="Previous page"
                disabled={!pages || page <= 1}
                onClick={() => go(page - 1)}
              >
                <Icon name="chevron" className="size-4 rotate-180" />
              </button>
              <span
                aria-live="polite"
                aria-label={pages ? `Page ${page} of ${pages}` : "Opening"}
                className="min-w-[44px] text-center text-[12px] font-semibold whitespace-nowrap tabular-nums"
              >
                {pages ? `${page} / ${pages}` : "…"}
              </span>
              <button
                type="button"
                className={btn}
                aria-label="Next page"
                disabled={!pages || page >= pages}
                onClick={() => go(page + 1)}
              >
                <Icon name="chevron" className="size-4" />
              </button>
            </>
          )}
          <button
            type="button"
            className={`${btn} ${error ? "" : "ml-1"}`}
            aria-label="Download the original"
            title="Download the original"
            onClick={() => download(path, doc.fileName).catch(() => {})}
          >
            <Icon name="download" className="size-4" />
          </button>
        </div>
      </header>

      {/* one page tall and fixed: only the ‹ › buttons and "Cited page" change the page; no box around it */}
      <div
        ref={host}
        className={`kero-pages min-w-0 overflow-x-hidden ${error ? "flex-1" : ""} overflow-y-hidden overscroll-none rounded-[10px]`}
        style={{
          height: error
            ? undefined
            : pageH || (width ? Math.round(width * A4) : undefined),
          scrollbarWidth: "none",
          overflowAnchor: "none",
          clipPath: "inset(0 round 10px)",
        }}
      >
        {error ? (
          <p className="flex h-full min-h-[200px] items-center justify-center rounded-[10px] border border-line bg-paper px-6 text-center text-[13px] text-mute">
            {error}
          </p>
        ) : !blob || !width ? (
          <div className="aspect-[1/1.414] w-full animate-pulse rounded-[10px] border border-line bg-paper" />
        ) : isPdf ? (
          <PdfPages
            blob={blob}
            width={width}
            quote={evidence.quote}
            page={evidence.page}
            onRendered={onRendered}
          />
        ) : (
          <DocxPages
            blob={blob}
            width={width}
            quote={evidence.quote}
            onRendered={onRendered}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- PDF ---------- */

type PdfModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

function PdfPages({
  blob,
  width,
  quote,
  page,
  onRendered,
}: {
  blob: Blob;
  width: number;
  quote: string;
  page: number;
  onRendered(n: number, marked: number | null): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(onRendered);
  useEffect(() => {
    done.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let destroy = () => {};
    (async () => {
      const pdfjs: PdfModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({
        data: new Uint8Array(await blob.arrayBuffer()),
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
      });
      destroy = () => void task.destroy();
      const pdf = await task.promise;
      if (cancelled) return;
      el.replaceChildren();
      const first = await pdf.getPage(1);
      const scale = width / first.getViewport({ scale: 1 }).width;
      // draw sharper than the screen needs, so text stays crisp once fitted to the column (2x even on standard screens)
      const ratio = Math.min(
        3,
        Math.max(2, window.devicePixelRatio || 1) * 1.25,
      );
      const found: number[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        if (cancelled) return;
        const p = n === 1 ? first : await pdf.getPage(n);
        const vp = p.getViewport({ scale });
        const wrap = document.createElement("div");
        wrap.dataset.page = String(n);
        wrap.className =
          "relative mb-4 overflow-hidden rounded-[10px] border border-line bg-white";
        wrap.style.width = `${vp.width}px`;
        wrap.style.height = `${vp.height}px`;
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width * ratio);
        canvas.height = Math.floor(vp.height * ratio);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;
        wrap.appendChild(canvas);
        el.appendChild(wrap);
        // each page stands alone: one that fails to draw or read never stops the rest
        try {
          await p.render({
            canvas,
            viewport: vp,
            transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
          }).promise;
        } catch (err) {
          console.warn(`PDF page ${n} could not be drawn`, err);
        }
        try {
          if (markPdfQuote(pdfjs, wrap, await p.getTextContent(), vp, quote))
            found.push(n);
        } catch (err) {
          console.warn(`PDF page ${n} text could not be read`, err);
        }
      }
      if (!cancelled)
        done.current(
          pdf.numPages,
          found.includes(page) ? page : (found[0] ?? null),
        );
    })().catch((err) => console.error("The PDF could not be opened", err));
    return () => {
      cancelled = true;
      destroy();
    };
  }, [blob, width, quote, page]);

  return <div ref={host} />;
}

type TextItem = { str: string; transform: number[]; width: number };

/** Draws a highlight over exactly the quoted characters on this page; returns whether the quote is here. */
function markPdfQuote(
  pdfjs: PdfModule,
  wrap: HTMLElement,
  content: { items: unknown[] },
  vp: { transform: number[]; scale: number },
  quote: string,
) {
  const items = content.items.filter(
    (i): i is TextItem => typeof (i as TextItem).str === "string",
  );
  // every non-space character, with the item it came from, so a quote can span lines
  const start: number[] = [];
  const size: number[] = [];
  let joined = "";
  items.forEach((it) => {
    const t = strip(it.str);
    start.push(joined.length);
    size.push(t.length);
    joined += t;
  });
  const needle = strip(quote);
  const at = needle ? joined.indexOf(needle) : -1;
  if (at < 0) return false;
  const end = at + needle.length;
  items.forEach((it, i) => {
    const from = Math.max(at, start[i]);
    const to = Math.min(end, start[i] + size[i]);
    if (to <= from || !size[i]) return;
    // trim to the quoted characters inside a line (proportional to its glyph count)
    const a = (from - start[i]) / size[i];
    const b = (to - start[i]) / size[i];
    const tx = pdfjs.Util.transform(vp.transform, it.transform);
    const h = Math.hypot(tx[2], tx[3]);
    const w = it.width * vp.scale;
    const mark = document.createElement("span");
    mark.dataset.keroMark = "";
    mark.style.cssText = `position:absolute;left:${tx[4] + w * a - 1.5}px;top:${tx[5] - h * 0.95}px;width:${w * (b - a) + 3}px;height:${h * 1.3}px;background:${MARK};border-radius:3px;box-shadow:inset 0 -2px 0 #e30613;pointer-events:none`;
    wrap.appendChild(mark);
  });
  return true;
}

/* ---------- Word ---------- */

function DocxPages({
  blob,
  width,
  quote,
  onRendered,
}: {
  blob: Blob;
  width: number;
  quote: string;
  onRendered(n: number, marked: number | null): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const styles = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tick, setTick] = useState(0);
  const pending = useRef<{ count: number; marked: number | null } | null>(null);
  const done = useRef(onRendered);
  useEffect(() => {
    done.current = onRendered;
  }, [onRendered]);

  useEffect(() => {
    const el = host.current;
    if (!el || !styles.current) return;
    let cancelled = false;
    import("docx-preview")
      .then(async ({ renderAsync }) => {
        el.replaceChildren();
        await renderAsync(blob, el, styles.current!, {
          inWrapper: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          ignoreLastRenderedPageBreak: false,
          className: "docx",
        });
        if (cancelled) return;
        // no grey desk: the pages sit straight on the page, like the PDF ones
        const wrapper = el.querySelector<HTMLElement>(".docx-wrapper");
        if (wrapper)
          wrapper.style.cssText =
            "background:transparent;padding:0;display:block";
        const pages = [...el.querySelectorAll<HTMLElement>("section.docx")];
        pages.forEach((p, i) => {
          p.dataset.page = String(i + 1);
          p.style.margin = "0";
          p.style.boxShadow = "none";
          p.style.border = `${Math.max(1, Math.round(1 / (width / (p.offsetWidth || 794))))}px solid #e5e5e3`;
          // the zoom scales this radius down, so set it so the page shows ~10px corners
          p.style.borderRadius = `${Math.round(10 / (width / (p.offsetWidth || 794)))}px`;
          p.style.overflow = "hidden";
        });
        const marked = markDocxQuote(el, quote);
        const markedPage = marked
          ? Number(marked.closest<HTMLElement>("section.docx")?.dataset.page) ||
            null
          : null;
        const z = width / (pages[0]?.offsetWidth || 794);
        pages.forEach((p) => {
          p.style.marginBottom = `${Math.round(16 / z)}px`;
        });
        pending.current = { count: pages.length, marked: markedPage };
        setZoom(z);
        setTick((t) => t + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [blob, quote, width]);

  // the zoom is applied by now, so positions and heights are final
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    requestAnimationFrame(() => done.current(p.count, p.marked));
  }, [tick]);

  return (
    <>
      <div ref={styles} />
      <div ref={host} style={{ zoom }} />
    </>
  );
}

/** Wraps the quoted wording in a highlight (or the whole paragraph if Word split it across runs); returns the marked element. */
function markDocxQuote(root: HTMLElement, quote: string): HTMLElement | null {
  const needle = quote.trim();
  if (!needle) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue ?? "";
    const i = text.indexOf(needle);
    if (i < 0) continue;
    const range = document.createRange();
    range.setStart(n, i);
    range.setEnd(n, i + needle.length);
    const mark = document.createElement("mark");
    mark.dataset.keroMark = "";
    mark.style.cssText = `background:${MARK};color:inherit;box-shadow:inset 0 -2px 0 #e30613;border-radius:2px;padding:0 1px`;
    range.surroundContents(mark);
    return mark;
  }
  const want = strip(needle);
  const para = [...root.querySelectorAll<HTMLElement>("p")].find((p) =>
    strip(p.textContent ?? "").includes(want),
  );
  if (!para) return null;
  para.dataset.keroMark = "";
  para.style.background = MARK;
  para.style.boxShadow = "inset 3px 0 0 #e30613";
  return para;
}

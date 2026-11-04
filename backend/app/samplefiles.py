"""
Real PDF and Word files for the sample (demo) workspace.

Sample documents are created from text, so there is no uploaded original to
open. These builders lay them out as complete company documents in the
KeroSOP style (black type, red accents, the KeroSOP mark): a title block with
document control, ten pages or more of body text written for the document's
topic (samplecontent.py), every cited clause on the page its citations name
(so "p. 4" in a finding is page 4 of the file), and a revision history with
approvals at the end. Pages are packed until full: the PDF measures each
block, the Word file estimates it from line lengths.
"""
from __future__ import annotations

import io
import re
from datetime import date
from pathlib import Path

from .samplecontent import Block, guidance, stream

LOGO = Path(__file__).parent / "assets" / "kerosop-logo.png"
CJK = re.compile(r"[㐀-鿿　-〿＀-￯]")
RED, INK, MUTE, LINE = "#E30613", "#171717", "#62625F", "#E5E5E3"
MIN_PAGES = 10
# bump whenever the generated files change: stored copies from an older revision are rebuilt on next download
REVISION = 3

AUTHORITY = {
    "corporate_policy": ("Corporate policy", "公司政策"),
    "department_sop": ("Department SOP", "部门操作规程"),
    "training": ("Training material", "培训资料"),
    "template": ("Template", "模板"),
}


def _zh(*texts: str) -> bool:
    return any(CJK.search(t or "") for t in texts)


LABEL = re.compile(r"^([^:：。.!?]{2,30}[:：])\s*(.*)$", re.S)


def _split_label(text: str) -> tuple[str, str]:
    """('Who does it:', 'the colleague…') when a paragraph opens with a short label, else ('', text)."""
    m = LABEL.match(text)
    return (m.group(1), m.group(2)) if m and m.group(2) else ("", text)


def _labels(meta: dict) -> dict:
    zh = meta["zh"]
    auth = AUTHORITY.get(meta.get("authority") or "department_sop", AUTHORITY["department_sop"])[1 if zh else 0]
    return {
        "auth": auth,
        "rows": [
            ("文件编号" if zh else "Document", meta.get("code", "")),
            ("版本" if zh else "Version", meta["version"]),
            ("负责人" if zh else "Owner", meta.get("owner") or "—"),
            ("部门" if zh else "Department", meta.get("department") or "—"),
            ("生效日期" if zh else "Effective", meta.get("effective") or "—"),
            ("密级" if zh else "Classification", "内部" if zh else "Internal"),
        ],
        "history": "修订记录" if zh else "Revision history",
        "approval": "审批" if zh else "Approval",
        "hist_cols": ("版本", "日期", "修订人", "说明") if zh else ("Version", "Date", "By", "Change"),
        "appr_cols": ("角色", "姓名", "日期") if zh else ("Role", "Name", "Date"),
        "appr": [("编制" if zh else "Prepared by", meta.get("owner") or "—"), ("审核" if zh else "Reviewed by", "合规办公室" if zh else "Compliance Office"), ("批准" if zh else "Approved by", "政策委员会" if zh else "Policy Committee")],
        "footer": "Harbour & Co. Retail · 内部资料 · 打印件不受控" if zh else "Harbour & Co. Retail · Internal · Uncontrolled when printed",
        "page": "第 {n} 页，共 {t} 页" if zh else "Page {n} of {t}",
    }


# ---------- packing ----------

def _units(blocks: list[Block]) -> list[dict]:
    """Blocks split into what can break across pages: a heading travels with its first paragraph."""
    out = []
    for b in blocks:
        for i, p in enumerate(b.paras):
            out.append({"head": b.heading if i == 0 else None, "text": p, "bullet": b.bullets and not (i == 0 and p.endswith(("：", ":"))), "chapter": b.chapter and i == 0, "cited": False})
    return out


def _pack(meta: dict, sections: list[dict], measure, cap_first: float, cap: float, tail: float) -> list[list[dict]]:
    """
    Pages of units, each filled to `cap` (page 1 less the title block, the last
    page less `tail` for the history and approval tables). Cited sections land
    on their own page; body text flows around them, numbered so the order
    always reads correctly.
    """
    cited: dict[int, list[dict]] = {}
    for s in sections:
        cited.setdefault(max(1, int(s.get("page") or 1)), []).append(
            {"head": s.get("heading") or "", "ref": s["ref"], "text": s["text"], "bullet": False, "chapter": False, "cited": True}
        )
    total = max(MIN_PAGES, *cited.keys()) if cited else MIN_PAGES
    taken = {(s.get("heading") or "").strip().lower() for s in sections}
    blocks = stream(meta["title"], meta.get("owner"), meta.get("department"), meta["zh"]) + guidance(meta["title"], meta["zh"])
    body = _units([b for b in blocks if b.heading.strip().lower() not in taken])
    used = {s["ref"] for s in sections}
    top = lambda ref: int(ref.split(".")[0]) if ref and ref.split(".")[0].isdigit() else 0
    state = {"top": 0, "parent": None, "kids": {}}

    def child(parent: str) -> str:
        k = state["kids"].get(parent, 0) + 1
        while f"{parent}.{k}" in used:
            k += 1
        state["kids"][parent] = k
        return f"{parent}.{k}"

    def next_cited_top(p: int) -> int | None:
        later = [top(u["ref"]) for q, us in cited.items() if q > p for u in us if top(u["ref"])]
        return min(later) if later else None

    def number(u: dict, p: int) -> None:
        if not u["head"] or u["cited"]:
            return
        nxt = next_cited_top(p)
        if u["chapter"] and (nxt is None or nxt - state["top"] >= 2):
            n = state["top"] + 1
            while str(n) in used:
                n += 1
            u["ref"] = str(n)
            used.add(u["ref"])
            state["top"], state["parent"] = n, u["ref"]
        else:
            u["ref"] = child(state["parent"] or str(max(state["top"], 1)))
            used.add(u["ref"])

    def place_cited(u: dict) -> None:
        state["top"] = max(state["top"], top(u["ref"]))
        state["parent"] = u["ref"]

    pages: list[list[dict]] = []
    i = 0
    for p in range(1, total + 1):
        room = (cap_first if p == 1 else cap) - (tail if p == total else 0)
        here = cited.get(p, [])
        reserve = sum(measure(u) for u in here)
        page: list[dict] = []
        if p == 1:  # the title page opens with its cited clauses
            for u in here:
                place_cited(u)
                page.append(u)
                room -= measure(u)
            reserve, here = 0, []
        # finish a block that started on the last page, then new blocks, leaving room for this page's cited clauses
        while i < len(body):
            u = body[i]
            if u["head"] and here and page and reserve and room - measure(u) < reserve:
                break
            h = measure(u)
            if h > room - reserve:
                break
            number(u, p)
            page.append(u)
            room -= h
            i += 1
        for u in here:
            place_cited(u)
            page.append(u)
            room -= measure(u)
        while i < len(body) and here:
            u = body[i]
            if measure(u) > room:
                break
            number(u, p)
            page.append(u)
            room -= measure(u)
            i += 1
        pages.append(page)
    return pages


# ---------- PDF ----------

def _flat_logo():
    """The mark on solid white, with no alpha channel: PDF viewers then draw its white line as white."""
    if not LOGO.exists():
        return None
    from PIL import Image
    from reportlab.lib.utils import ImageReader

    im = Image.open(LOGO).convert("RGBA")
    flat = Image.new("RGB", im.size, (255, 255, 255))
    flat.paste(im, mask=im.getchannel("A"))
    return ImageReader(flat)


def build_pdf(meta: dict, sections: list[dict], pages: int | None = None) -> bytes:
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    zh = meta["zh"]
    if zh:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    reg, bold = ("STSong-Light", "STSong-Light") if zh else ("Helvetica", "Helvetica-Bold")
    ink, mute, red, line = HexColor(INK), HexColor(MUTE), HexColor(RED), HexColor(LINE)
    L = _labels(meta)
    wrap = {"wordWrap": "CJK"} if zh else {}
    st = {
        "kicker": ParagraphStyle("k", fontName=bold, fontSize=10, leading=13, textColor=red, spaceAfter=8, **wrap),
        "title": ParagraphStyle("t", fontName=bold, fontSize=30, leading=36, textColor=ink, spaceAfter=12, **wrap),
        "h": ParagraphStyle("h", fontName=bold, fontSize=15, leading=20, textColor=ink, spaceBefore=12, spaceAfter=5, **wrap),
        "body": ParagraphStyle("b", fontName=reg, fontSize=12.5, leading=21 if zh else 19, textColor=ink, spaceAfter=6, **wrap),
        "item": ParagraphStyle("i", fontName=reg, fontSize=12.5, leading=21 if zh else 19, textColor=ink, leftIndent=16, spaceAfter=4,
                               bulletFontName="Helvetica-Bold", bulletColor=red, bulletFontSize=13, **wrap),
        "cell": ParagraphStyle("c", fontName=reg, fontSize=11, leading=14, textColor=ink, **wrap),
        "cellh": ParagraphStyle("ch", fontName=bold, fontSize=10.5, leading=13, textColor=white, **wrap),
        "label": ParagraphStyle("cl", fontName=reg, fontSize=10, leading=13, textColor=mute, **wrap),
    }
    if zh:
        # CJK glyphs need a larger optical size; page furniture stays unchanged.
        for style in st.values():
            style.fontSize *= 1.12
            style.leading *= 1.12
    W = A4[0] - 44 * mm  # text, tables and the header rule share the 22 mm margins (the frame's 6 pt padding is taken out of the margin below)
    TOP, BOTTOM = 28 * mm, 26 * mm  # the body starts ~8 mm under the header rule, as in the Word version
    H = A4[1] - TOP - BOTTOM - 12  # frame height less its padding

    def flow(u: dict) -> list:
        out = []
        if u["head"]:
            out.append(Paragraph(f'<font color="{RED}">{escape(u.get("ref", ""))}</font>&nbsp;&nbsp;&nbsp;{escape(u["head"])}', st["h"]))
        label, rest = _split_label(u["text"])
        if label:
            mark = f'<font color="{RED}">{escape(label)}</font>' if zh else f"<b>{escape(label)}</b>"
            markup = f"{mark} {escape(rest)}"
        else:
            markup = escape(u["text"])
        out.append(Paragraph(markup, st["item"], bulletText="–") if u["bullet"] else Paragraph(markup, st["body"]))
        return out

    def height(fs: list) -> float:
        total = 0.0
        for f in fs:
            _, h = f.wrap(W, H)
            total += h + f.getSpaceBefore() + f.getSpaceAfter()
        return total

    def grid(rows, widths, head=False):
        t = Table(rows, colWidths=widths, hAlign="LEFT")
        # black 0.5 pt borders, the same as Word's "Table Grid"
        style = [("GRID", (0, 0), (-1, -1), 0.5, ink), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                 ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]
        if head:
            style.append(("BACKGROUND", (0, 0), (-1, 0), ink))
        t.setStyle(TableStyle(style))
        return t

    control = [[Paragraph(escape(k), st["label"]), Paragraph(escape(str(v)), st["cell"])] for k, v in L["rows"]]
    title_block = [Paragraph(escape(L["auth"] if zh else L["auth"].upper()), st["kicker"]), Paragraph(escape(meta["title"]), st["title"]),
                   grid([control[i] + control[i + 3] for i in range(3)], [W * 0.17, W * 0.33, W * 0.17, W * 0.33]), Spacer(1, 6)]
    hist = [[Paragraph(escape(c), st["cellh"]) for c in L["hist_cols"]]] + [[Paragraph(escape(str(x)), st["cell"]) for x in row] for row in meta.get("history", [])]
    appr = [[Paragraph(escape(c), st["cellh"]) for c in L["appr_cols"]]] + [
        [Paragraph(escape(r), st["cell"]), Paragraph(escape(n), st["cell"]), Paragraph(escape(meta.get("effective") or "—"), st["cell"])] for r, n in L["appr"]
    ]
    tail = [Paragraph(escape(L["history"]), st["h"]), grid(hist, [W * 0.13, W * 0.2, W * 0.22, W * 0.45], head=True),
            Paragraph(escape(L["approval"]), st["h"]), grid(appr, [W * 0.3, W * 0.4, W * 0.3], head=True)]

    measure = lambda u: height(flow(u))
    grouped = _pack(meta, sections, measure, H - height(title_block) - 4, H - 4, height(tail) + 8)
    story = []
    for n, page in enumerate(grouped, 1):
        if n == 1:
            story += title_block
        for u in page:
            fs = flow(u)
            story.append(KeepTogether(fs) if len(fs) > 1 else fs[0])
        if n == len(grouped):
            story += tail
        else:
            story.append(PageBreak())

    total = len(grouped)
    logo = _flat_logo()

    def frame(canvas, doc):
        canvas.saveState()
        mark = 9.5 * mm  # the Word header's logo size
        mid = A4[1] - 15 * mm  # vertical centre of the header row
        if logo is not None:
            canvas.drawImage(logo, 22 * mm, mid - mark / 2, width=mark, height=mark)
        # baselines sit so the cap height is centred on the mark
        # a step up from Word's 12/11 pt: Helvetica draws smaller than the Arial the Word viewer uses
        canvas.setFont(bold, 13)
        canvas.setFillColor(ink)
        canvas.drawString(22 * mm + mark + 3.1 * mm, mid - 13 * 0.35, "Harbour & Co. Retail")
        canvas.setFont(bold, 12)
        canvas.setFillColor(red)
        canvas.drawRightString(A4[0] - 22 * mm, mid - 12 * 0.35, f"{meta.get('code', '')} · v{meta['version']}")
        canvas.setStrokeColor(red)
        canvas.setLineWidth(0.9)  # a thin red rule a little under the logo row, as in the Word version
        canvas.line(22 * mm, mid - mark / 2 - 2.6 * mm, A4[0] - 22 * mm, mid - mark / 2 - 2.6 * mm)
        canvas.setStrokeColor(line)
        canvas.setLineWidth(0.6)
        canvas.line(22 * mm, 18 * mm, A4[0] - 22 * mm, 18 * mm)  # a little air between the footer rule and its text
        # the same 10/11 pt as the Word footer
        canvas.setFont(reg, 10)
        canvas.setFillColor(mute)
        canvas.drawString(22 * mm, 11.5 * mm, L["footer"])
        canvas.setFont(bold, 11)
        canvas.setFillColor(ink)
        canvas.drawRightString(A4[0] - 22 * mm, 11.5 * mm, L["page"].format(n=doc.page, t=total))
        canvas.restoreState()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=22 * mm - 6, rightMargin=22 * mm - 6, topMargin=TOP, bottomMargin=BOTTOM,
                            title=meta["title"], author=meta.get("owner") or "Harbour & Co. Retail", creator="KeroSOP")
    doc.build(story, onFirstPage=frame, onLaterPages=frame)
    return buf.getvalue()


# ---------- Word ----------

def build_docx(meta: dict, sections: list[dict], pages: int | None = None) -> bytes:
    import math

    from docx import Document
    from docx.enum.section import WD_SECTION
    from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    zh = meta["zh"]
    L = _labels(meta)
    ink, mute, red, white = RGBColor(0x17, 0x17, 0x17), RGBColor(0x62, 0x62, 0x5F), RGBColor(0xE3, 0x06, 0x13), RGBColor(0xFF, 0xFF, 0xFF)
    latin, east = "Arial", "Microsoft YaHei"

    d = Document()
    normal = d.styles["Normal"]
    normal.font.name = latin
    normal.font.size = Pt(14 if zh else 12.5)
    normal.font.color.rgb = ink
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), east)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = Pt(23.52 if zh else 19)  # the PDF's leading

    first = d.sections[0]
    first.page_width, first.page_height = Cm(21), Cm(29.7)
    first.left_margin = first.right_margin = Cm(2.2)
    # the footer sits in the band between footer distance and bottom margin, text at its top: a narrow band
    # low on the page puts the footer line ~12 mm up, as in the PDF
    first.top_margin, first.bottom_margin = Cm(3.0), Cm(1.8)
    first.header_distance, first.footer_distance = Cm(1.1), Cm(0.8)
    text_width = first.page_width - first.left_margin - first.right_margin

    def run(par, text, *, size=None, color=None, b=False, furniture=False):
        r = par.add_run(text)
        r.bold = b
        # docx-preview applies the document's default run style (11 pt) on
        # spans, overriding a font size inherited from the Normal paragraph.
        # Set it on every run so Word and the browser both use the PDF sizes.
        r.font.size = Pt((size if size is not None else 12.5) * (1.12 if zh and not furniture else 1))
        if color is not None:
            r.font.color.rgb = color
        r.font.name = latin  # creates the run's font element, so the East Asian font can be set on it
        r._element.rPr.rFonts.set(qn("w:eastAsia"), east)
        return r

    def border(par, color="E30613", sz=10):
        p_pr = par._p.get_or_add_pPr()
        bdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        for k, v in (("w:val", "single"), ("w:sz", str(sz)), ("w:space", "4"), ("w:color", color)):
            bottom.set(qn(k), v)
        bdr.append(bottom)
        p_pr.append(bdr)

    def shade(cell, fill):
        shd = OxmlElement("w:shd")
        for k, v in (("w:val", "clear"), ("w:color", "auto"), ("w:fill", fill)):
            shd.set(qn(k), v)
        cell._tc.get_or_add_tcPr().append(shd)

    def no_borders(table):
        borders = OxmlElement("w:tblBorders")
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            el = OxmlElement(f"w:{edge}")
            el.set(qn("w:val"), "nil")
            borders.append(el)
        table._tbl.tblPr.append(borders)

    def bar(container, cells, widths):
        """A borderless row of cells, vertically centred: reads the same in Word and in any viewer."""
        t = container.add_table(rows=1, cols=len(cells), width=text_width)
        t.autofit = False
        no_borders(t)
        layout = OxmlElement("w:tblLayout")
        layout.set(qn("w:type"), "fixed")
        t._tbl.tblPr.append(layout)
        for col, w in zip(t.columns, widths):
            col.width = w
        for i, (fill, w) in enumerate(zip(cells, widths)):
            c = t.cell(0, i)
            c.width = w
            c.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            par = c.paragraphs[0]
            par.paragraph_format.space_after = Pt(0)
            par.paragraph_format.line_spacing = 1
            if i == len(cells) - 1 and len(cells) > 1:
                par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            fill(par)
        return t

    def header(section):
        hd = section.header
        hd.is_linked_to_previous = False
        for par in list(hd.paragraphs):
            hd._element.remove(par._p)
        logo = lambda par: LOGO.exists() and par.add_run().add_picture(str(LOGO), width=Cm(0.95))
        row = bar(hd, [logo, lambda par: run(par, "Harbour & Co. Retail", size=12, color=ink, b=True, furniture=True), lambda par: run(par, f"{meta.get('code', '')} · v{meta['version']}", size=11, color=red, b=True, furniture=True)],
                  [Cm(1.25), text_width - Cm(1.25) - Cm(5), Cm(5)])
        # the red rule is the row's bottom border, which every viewer draws in colour
        for cell in row.rows[0].cells:
            tc_b = OxmlElement("w:tcBorders")
            bottom = OxmlElement("w:bottom")
            for k, v in (("w:val", "single"), ("w:sz", "10"), ("w:space", "0"), ("w:color", "E30613")):
                bottom.set(qn(k), v)
            tc_b.append(bottom)
            cell._tc.get_or_add_tcPr().append(tc_b)
            cell.paragraphs[0].paragraph_format.space_after = Pt(5)
        hd.add_paragraph().paragraph_format.space_after = Pt(0)

    def footer(section, n: int, t: int):
        """Each page is its own Word section, so its footer states the page number in plain text."""
        ft = section.footer
        ft.is_linked_to_previous = False
        for par in list(ft.paragraphs):
            ft._element.remove(par._p)
        row = bar(ft, [lambda par: run(par, L["footer"], size=10, color=mute, furniture=True), lambda par: run(par, L["page"].format(n=n, t=t), size=11, color=ink, b=True, furniture=True)], [text_width - Cm(4.5), Cm(4.5)])
        # the PDF footer's thin grey rule sits above the footer line
        for cell in row.rows[0].cells:
            tc_b = OxmlElement("w:tcBorders")
            top = OxmlElement("w:top")
            for k, v in (("w:val", "single"), ("w:sz", "4"), ("w:space", "0"), ("w:color", "E5E5E3")):
                top.set(qn(k), v)
            tc_b.append(top)
            cell._tc.get_or_add_tcPr().append(tc_b)
            cell.paragraphs[0].paragraph_format.space_before = Pt(9)  # a little air between the footer rule and its text
        # Word needs a paragraph after the table; keep it 1 pt so the footer sits as low as the PDF's
        tail = ft.add_paragraph()
        tail.paragraph_format.space_after = Pt(0)
        tail.paragraph_format.line_spacing = Pt(1)
        run(tail, "", size=1, furniture=True)

    def table(rows, widths, head=False):
        t = d.add_table(rows=len(rows), cols=len(rows[0]))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.LEFT
        for i, row in enumerate(rows):
            for j, val in enumerate(row):
                cell = t.cell(i, j)
                cell.width = widths[j]
                par = cell.paragraphs[0]
                par.paragraph_format.space_before = Pt(3)
                par.paragraph_format.space_after = Pt(3)
                par.paragraph_format.line_spacing = Pt((13 if head and i == 0 else 14) * (1.12 if zh else 1))
                if head and i == 0:
                    shade(cell, "171717")
                    run(par, val, size=10.5, color=white, b=True)
                else:
                    label = not head and j % 2 == 0
                    run(par, str(val), size=10 if label else 11, color=mute if label else ink)
        return t

    # estimate, in points, how much of a page a unit takes at the PDF's sizes (12.5 pt text on 19 or 21 pt lines)
    lh = 23.52 if zh else 19
    cpl = 32 if zh else 74
    lines = lambda text: max(1, math.ceil(len(text) / cpl))
    measure = lambda u: (12 + 20 + 5 if u["head"] else 0) + lines(u["text"]) * lh + 6
    body = 640  # A4 less margins, header and footer, with room to spare: an overfull page would spill past A4
    title_block = 13 + 8 + 36 + 10 + 3 * 22 + 14
    tail_block = 2 * (12 + 20 + 5) + 22 * (len(meta.get("history", [])) + 1) + 22 * 4 + 10

    grouped = _pack(meta, sections, measure, body - title_block, body, tail_block)
    total = len(grouped)
    for n, page in enumerate(grouped, 1):
        if n > 1:
            # a continuous section gives this page its own footer; the page itself starts at the
            # "page break before" set on its first paragraph below (viewers break only on that, and it adds no empty line)
            d.add_section(WD_SECTION.CONTINUOUS)
        sec = d.sections[-1]
        starts_page = n > 1
        header(sec)
        footer(sec, n, total)
        if n == 1:
            k = d.add_paragraph()
            k.paragraph_format.line_spacing = Pt(14.56 if zh else 13)
            k.paragraph_format.space_after = Pt(8)
            run(k, L["auth"] if zh else L["auth"].upper(), size=10, color=red, b=True)
            t = d.add_paragraph()
            t.paragraph_format.line_spacing = Pt(40.32 if zh else 36)
            t.paragraph_format.space_after = Pt(12)
            run(t, meta["title"], size=30, color=ink, b=True)
            rows = L["rows"]
            table([[rows[i][0], rows[i][1], rows[i + 3][0], rows[i + 3][1]] for i in range(3)], [Cm(2.8), Cm(5.5), Cm(2.8), Cm(5.5)])
            d.add_paragraph().paragraph_format.space_after = Pt(6)
        for u in page:
            if u["head"]:
                h = d.add_paragraph()
                h.paragraph_format.space_before = Pt(0 if starts_page else 12)
                h.paragraph_format.space_after = Pt(5)
                h.paragraph_format.line_spacing = Pt(22.4 if zh else 20)
                h.paragraph_format.keep_with_next = True
                h.paragraph_format.page_break_before = starts_page
                starts_page = False
                run(h, u.get("ref", ""), size=15, color=red, b=True)
                run(h, "   " + u["head"], size=15, color=ink, b=True)
            para = d.add_paragraph()
            if starts_page:  # the page opens with a paragraph carried over from the last page
                para.paragraph_format.page_break_before = True
                starts_page = False
            if u["bullet"]:
                para.paragraph_format.space_after = Pt(4)
                para.paragraph_format.left_indent = Cm(0.55)
                para.paragraph_format.first_line_indent = Cm(-0.45)
                run(para, "–  ", color=red, b=True)
            label, rest = _split_label(u["text"])
            if label:
                run(para, label + " ", b=True)
                run(para, rest)
            else:
                run(para, u["text"])
        if n == total:
            for title, cols, rows, widths in (
                (L["history"], L["hist_cols"], meta.get("history", []), [Cm(2.2), Cm(3.2), Cm(3.6), Cm(7.6)]),
                (L["approval"], L["appr_cols"], [(r, nm, meta.get("effective") or "—") for r, nm in L["appr"]], [Cm(5), Cm(6.6), Cm(5)]),
            ):
                h = d.add_paragraph()
                h.paragraph_format.space_before = Pt(12)
                h.paragraph_format.line_spacing = Pt(22.4 if zh else 20)
                h.paragraph_format.keep_with_next = True
                run(h, title, size=15, color=ink, b=True)
                table([list(cols)] + [list(map(str, r)) for r in rows], widths, head=True)

    d.core_properties.title = meta["title"]
    d.core_properties.author = meta.get("owner") or "Harbour & Co. Retail"
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


def build(kind: str, meta: dict, sections: list[dict], pages: int | None = None) -> tuple[bytes, str]:
    """Bytes and file extension for a sample document; Markdown and text samples are built as PDF."""
    meta = {**meta, "zh": _zh(meta["title"], *(s["text"] for s in sections))}
    if kind == "docx":
        return build_docx(meta, sections, pages), "docx"
    return build_pdf(meta, sections, pages), "pdf"


def date_label(value) -> str:
    if not value:
        return ""
    d = value if isinstance(value, date) else date.fromisoformat(str(value)[:10])
    return d.strftime("%-d %b %Y")

"""
Document ingestion: bytes → normalised sections with page numbers.

PDF uses pdfplumber (MIT), DOCX python-docx (MIT), TXT/Markdown plain text.
Pages without a text layer are reported as needing OCR; nothing is guessed.
OCR (PaddleOCR) and Docling layout extraction are not enabled in this build:
scanned files stop at `needs_ocr` and never produce findings.

Uploaded content is untrusted. Parsing never follows links, executes macros
or evaluates anything inside the file.
"""
from __future__ import annotations

import hashlib
import html
import io
import re
from dataclasses import dataclass, field

HEADING = re.compile(r"^(?:#{1,4}\s+(.+)|(\d+(?:\.\d+){0,3})[.)]?\s+([A-Z一-鿿][^\n]{1,70}))$")
LIST = re.compile(r"^\s*(\(?\d+[.)]|[-•*])\s+")
MAGIC = {"pdf": b"%PDF", "docx": b"PK\x03\x04"}


class ParseError(ValueError):
    pass


@dataclass
class Parsed:
    kind: str
    sections: list[dict] = field(default_factory=list)
    pages: int = 1
    issue: str | None = None
    checksum: str = ""
    size: int = 0


def kind_of(name: str) -> str | None:
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    return {"pdf": "pdf", "docx": "docx", "txt": "txt", "md": "md", "markdown": "md"}.get(ext)


def clean(text: str) -> str:
    text = text.replace("\r", "")
    text = re.sub(r"<!--[\s\S]*?-->", "", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"</?[a-zA-Z][^>]*>", "", text)
    return html.unescape(text)


def unwrap(lines: list[str]) -> str:
    """Rejoin lines a PDF or web page wrapped mid-sentence; keep paragraphs and list items."""
    out: list[str] = []
    for raw in lines:
        line = raw.strip()
        prev = out[-1] if out else None
        if not line:
            if prev != "":
                out.append("")
        elif prev and not LIST.match(line) and not re.search(r"[.。:：!?！？]$", prev):
            join = "" if re.search(r"[一-鿿]$", prev) and re.match(r"^[一-鿿]", line) else " "
            out[-1] = prev + join + line
        else:
            out.append(line)
    return re.sub(r"\n{2,}", "\n\n", "\n".join(out))


def sectionize(text: str, page_of=lambda o: o // 2800 + 1) -> list[dict]:
    lines = clean(text).split("\n")
    out: list[dict] = []
    cur: dict | None = None
    offset = 0
    n = 0

    def flush():
        if cur:
            body = unwrap(cur["body"]).strip()
            if body:
                out.append({"ref": cur["ref"], "heading": cur["heading"], "page": page_of(cur["start"]), "text": body})

    for raw in lines:
        line = raw.strip()
        m = HEADING.match(line)
        is_heading = m and (m.group(1) or (m.group(3) and len(m.group(3)) < 60 and not re.search(r"[.。]$", m.group(3))))
        if is_heading:
            flush()
            n += 1
            cur = {"ref": m.group(2) or f"§{n}", "heading": re.sub(r"[*_`]", "", m.group(1) or m.group(3)).strip(), "start": offset, "body": []}
        else:
            if cur is None:
                cur = {"ref": "Intro", "heading": "Introduction", "start": offset, "body": []}
            cur["body"].append(re.sub(r"[*_`]{1,2}", "", re.sub(r"^(\s*)[*-]\s+", r"\1• ", raw)))
        offset += len(raw) + 1
    flush()

    seen: dict[str, int] = {}
    for s in out:  # references are part of every citation: keep them unique
        k = seen.get(s["ref"], 0)
        seen[s["ref"]] = k + 1
        if k:
            s["ref"] = f"{s['ref']}-{k + 1}"

    result: list[dict] = []
    for s in out:  # long sections are split so citations stay precise
        if len(s["text"]) < 2400:
            result.append(s)
            continue
        chunks, buf = [], ""
        for p in re.split(r"\n{2,}", s["text"]):
            if len(buf + p) > 1800 and buf:
                chunks.append(buf.strip())
                buf = ""
            buf += p + "\n\n"
        if buf.strip():
            chunks.append(buf.strip())
        for i, t in enumerate(chunks):
            result.append({**s, "ref": f"{s['ref']}.{chr(97 + i)}" if len(chunks) > 1 else s["ref"], "text": t})
    return result


def _pdf(data: bytes) -> tuple[list[str], int]:
    import pdfplumber

    pages = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        if len(pdf.pages) > 500:
            raise ParseError("PDFs up to 500 pages.")
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return pages, len(pages)


def _docx(data: bytes) -> str:
    import docx

    d = docx.Document(io.BytesIO(data))
    lines = []
    for p in d.paragraphs:
        if not p.text.strip():
            continue
        style = (p.style.name if p.style is not None else "") or ""
        lines.append(f"## {p.text}" if re.match(r"^(Heading|Title|标题)", style, re.I) else p.text)
    for table in d.tables:  # table rows become list items so each row can be cited
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                lines.append("- " + " | ".join(dict.fromkeys(cells)))
    return "\n".join(lines)


def parse(name: str, data: bytes, max_mb: int = 20) -> Parsed:
    kind = kind_of(name)
    if not kind:
        raise ParseError("Use a PDF, DOCX, TXT or Markdown file.")
    if len(data) > max_mb * 1024 * 1024:
        raise ParseError(f"Files up to {max_mb} MB.")
    if kind in MAGIC and not data.startswith(MAGIC[kind]):
        raise ParseError(f"This file is not a valid .{kind} (its contents do not match the extension).")
    checksum = hashlib.sha256(data).hexdigest()
    try:
        if kind == "pdf":
            pages, count = _pdf(data)
            offsets, total = [], 0
            for p in pages:
                offsets.append(total)
                total += len(p) + 1

            def page_of(o: int) -> int:
                i = 0
                while i + 1 < len(offsets) and offsets[i + 1] <= o:
                    i += 1
                return i + 1

            empty = [i + 1 for i, p in enumerate(pages) if len(p.strip()) < 20]
            sections = sectionize("\n".join(pages), page_of)
            issue = None
            if empty:
                issue = (
                    "No page has a text layer" if len(empty) == len(pages) else f"Page{'s' if len(empty) > 1 else ''} {', '.join(map(str, empty))} ha{'ve' if len(empty) > 1 else 's'} no text layer"
                ) + ". This looks scanned: OCR is needed before these pages can be checked."
            return Parsed(kind, sections, count, issue, checksum, len(data))
        text = _docx(data) if kind == "docx" else data.decode("utf-8", errors="replace")
    except ParseError:
        raise
    except Exception as exc:  # corrupt or encrypted file
        raise ParseError(f"The file could not be read ({type(exc).__name__}). Is it password-protected or damaged?") from exc
    sections = sectionize(text)
    return Parsed(kind, sections, max(1, len(text) // 2800 + 1), None if sections else "The file has no readable text.", checksum, len(data))

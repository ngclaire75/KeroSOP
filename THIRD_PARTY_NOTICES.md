# Third-party notices

KeroSOP uses the following third-party software, models, data and brand assets. Licences were checked when each was added; re-verify before redistribution or commercial launch.

## Models (run locally through Ollama; weights are not redistributed)
| Asset | Licence | Use |
|---|---|---|
| Qwen3-8B (`qwen3:8b`) | Apache-2.0 | Pairwise clause comparison |
| Qwen3-Embedding-0.6B (`qwen3-embedding:0.6b`) | Apache-2.0 | Cross-language retrieval of related clauses |
| Ollama | MIT | Local model server |

## Backend (Python)
FastAPI (MIT), Starlette (BSD-3-Clause), Uvicorn (BSD-3-Clause), SQLAlchemy (MIT), Alembic (MIT), psycopg 3 (LGPL-3.0, used as a dynamically linked library), pgvector-python (MIT), Pydantic (MIT), google-auth (Apache-2.0), httpx (BSD-3-Clause), requests (Apache-2.0), python-multipart (Apache-2.0), pdfplumber (MIT), pdfminer.six (MIT), python-docx (MIT), ReportLab (BSD), pytest (MIT).
PostgreSQL (PostgreSQL Licence), pgvector (PostgreSQL Licence).

## Web (JavaScript)
Next.js (MIT), React (MIT), Tailwind CSS (MIT), Firebase JS SDK (Apache-2.0), three.js (MIT), p5.js (LGPL-2.1, loaded as an unmodified library), anime.js (MIT), GSAP (GreenSock standard licence), Lenis (MIT), Phosphor Icons (MIT), Simple Icons (CC0-1.0), Iconify "logos" set (CC0-1.0).

## Brand logos
Slack, GitHub, Google Drive, Gmail, Notion, Confluence, Jira, Linear, Dropbox, Zapier, n8n, Make, Microsoft Teams and Microsoft OneDrive marks are trademarks of their owners. They appear only to indicate which services KeroSOP connects to or plans to connect to.

## Data
| Source | Licence | Use |
|---|---|---|
| Sparksuite employee handbook (`tests/fixtures/sparksuite`) | CC0-1.0 | Real-world precision and recall tests |
| Basecamp handbook, Axelisys open policies | Not CC0 (Basecamp: no licence; Axelisys: GPL-3.0) | Downloaded at test time only; no copy kept |
| KEROSOP seed set (`backend/ml/datasets/kerosop_sop_seed.jsonl`) | Synthetic, original (from the KEROSOP build kit) | Evaluation only; not expert-adjudicated |
| KEROSOP-SOP-SYNTH v1 (`backend/eval/pairs.jsonl`) | Synthetic, original | Evaluation only |
| ContractNLI, DocLayNet, OCNLI, XNLI | Various | **Not downloaded or used.** OCNLI is non-commercial and excluded. |

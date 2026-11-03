"""
End-to-end scan with the real model (Qwen3-8B via Ollama). Skipped unless
KEROSOP_LLM_ENABLED=1 and the model server is ready:

    KEROSOP_LLM_ENABLED=1 .venv/bin/python -m pytest tests/test_ai.py
"""
import pytest

from app import llm
from app.config import settings

pytestmark = pytest.mark.skipif(not settings.llm_enabled or not llm.status().get("ready"), reason="model server not enabled/ready")


def test_model_reviews_pair_rules_cannot_decide(alice):
    alice.upload("Refund Policy.md", b"## 4.1 Refund method\nRefunds must only be issued to the original payment method.\n", authority="corporate_policy")
    alice.upload("Store Guide.md", b"## 6 Refunds\nAgents may issue refunds as store credit or cash whenever the customer prefers.\n")
    scan = alice.scan(use_ai=True, timeout=300)
    assert scan["stage"] == "completed", scan
    assert scan["counts"]["ai_reviewed"] >= 1 and scan["model"]["reasoning"] == settings.llm_model
    ws = alice.get("/v1/workspace").json()
    [f] = ws["findings"]
    assert f["source"] == "ai" and f["status"] == "detected"
    assert f["type"] in ("contradiction", "prohibition")
    assert f["ai"]["prompt"] == llm.PROMPT_VERSION and f["ai"]["digest"]
    assert all(e["verified"] for e in f["evidence"])  # quotes re-checked against stored spans


def test_model_does_not_flag_compatible_pair(alice):
    alice.upload("Refund Policy.md", b"## 4.1 Refund method\nRefunds must only be issued to the original payment method.\n", authority="corporate_policy")
    alice.upload("Store Guide.md", b"## 6 Refunds\nAgents must check the receipt before a refund is issued to the original payment method.\n")
    scan = alice.scan(use_ai=True, timeout=300)
    assert scan["stage"] == "completed"
    assert alice.get("/v1/workspace").json()["findings"] == []

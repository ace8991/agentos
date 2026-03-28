from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.browser import infer_browser_bootstrap


class BrowserBootstrapTests(unittest.TestCase):
    def test_amazon_order_tasks_open_order_history(self) -> None:
        plan = infer_browser_bootstrap("verifier ma derniere commande amazone")

        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.source, "amazon-orders")
        self.assertIn("order-history", plan.url)

    def test_generic_web_tasks_open_search_workspace(self) -> None:
        plan = infer_browser_bootstrap("cherche le meilleur cadeau sur un site web pour un homme")

        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.source, "duckduckgo-search")
        self.assertIn("duckduckgo.com", plan.url)

    def test_explicit_url_is_used_directly(self) -> None:
        plan = infer_browser_bootstrap("ouvre https://example.com/pricing puis compare les offres")

        self.assertIsNotNone(plan)
        assert plan is not None
        self.assertEqual(plan.source, "explicit-url")
        self.assertEqual(plan.url, "https://example.com/pricing")


if __name__ == "__main__":
    unittest.main()

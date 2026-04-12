from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import skills_registry


class SkillsRegistryTests(unittest.TestCase):
    def test_sync_skill_catalog_reads_zip_manifests(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            zip_path = Path(tmp_dir) / "skills-main.zip"
            with zipfile.ZipFile(zip_path, "w") as archive:
                archive.writestr(
                    "skills-main/skills/web-artifacts-builder/SKILL.md",
                    """---
name: web-artifacts-builder
description: Build complex web artifacts with React and Tailwind.
---

# Web Artifacts Builder

- Use React + Vite + Tailwind CSS
- Prefer shadcn/ui for polished interfaces
""",
                )
                archive.writestr(
                    "skills-main/skills/docx/SKILL.md",
                    """---
name: docx
description: Create and edit Word documents.
---

# DOCX

- Use this for .docx editing
""",
                )

            catalog = skills_registry.sync_skill_catalog(zip_path, force=True)

        self.assertEqual(len(catalog), 2)
        self.assertTrue(all(skill["source"] == "imported" for skill in catalog))
        joined_prompts = " ".join(item["prompt"] for item in catalog)
        self.assertIn("React + Vite", joined_prompts)

    def test_find_relevant_skills_matches_query(self) -> None:
        skills_registry._cache = [
            {
                "id": "imported::web-artifacts-builder",
                "slug": "web-artifacts-builder",
                "name": "Web Artifacts Builder",
                "description": "Build React and Tailwind web applications.",
                "prompt": "Use React + Vite + Tailwind CSS.",
                "tags": ["react", "vite", "tailwind", "website", "app"],
            },
            {
                "id": "imported::docx",
                "slug": "docx",
                "name": "Docx",
                "description": "Create and edit Word documents.",
                "prompt": "Use this for docx workflows.",
                "tags": ["docx", "word", "document"],
            },
        ]

        matches = skills_registry.find_relevant_skills("create a website landing page", limit=2)

        self.assertEqual(matches[0]["slug"], "web-artifacts-builder")


if __name__ == "__main__":
    unittest.main()

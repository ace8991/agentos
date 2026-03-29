from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services import filesystem as fs


class FilesystemServiceTests(unittest.TestCase):
    def test_file_write_read_append_copy_move_delete_flow(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "notes.txt"
            copied = root / "copies" / "notes-copy.txt"
            moved = root / "archive" / "notes-final.txt"

            write_result = fs.file_write(str(source), "hello")
            self.assertTrue(write_result["success"])

            append_result = fs.file_append(str(source), "\nworld")
            self.assertTrue(append_result["success"])

            read_result = fs.file_read(str(source))
            self.assertTrue(read_result["success"])
            self.assertIn("hello", read_result["content"])
            self.assertIn("world", read_result["content"])

            copy_result = fs.file_copy(str(source), str(copied))
            self.assertTrue(copy_result["success"])
            self.assertTrue(copied.exists())

            move_result = fs.file_move(str(source), str(moved))
            self.assertTrue(move_result["success"])
            self.assertFalse(source.exists())
            self.assertTrue(moved.exists())

            delete_result = fs.file_delete(str(moved))
            self.assertTrue(delete_result["success"])
            self.assertFalse(moved.exists())

    def test_dir_list_exists_create_delete_and_system_info(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            folder = root / "workspace"
            child = folder / "doc.txt"

            create_result = fs.dir_create(str(folder))
            self.assertTrue(create_result["success"])

            fs.file_write(str(child), "artifact")

            exists_result = fs.file_exists(str(child))
            self.assertTrue(exists_result["success"])
            self.assertTrue(exists_result["exists"])
            self.assertEqual(exists_result["kind"], "file")

            list_result = fs.dir_list(str(folder))
            self.assertTrue(list_result["success"])
            self.assertEqual(list_result["total"], 1)
            self.assertEqual(list_result["items"][0]["name"], "doc.txt")

            delete_dir_result = fs.dir_delete(str(folder), recursive=True)
            self.assertTrue(delete_dir_result["success"])
            self.assertFalse(folder.exists())

        system_result = fs.system_info()
        self.assertTrue(system_result["success"])
        self.assertIn("os", system_result)


if __name__ == "__main__":
    unittest.main()

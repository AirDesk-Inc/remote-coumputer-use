"""Distribution checks that require neither AirDesk nor third-party packages."""

from pathlib import Path
import re
import struct
import unittest
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/remote-computer-use"


class PackageTests(unittest.TestCase):
    def test_local_markdown_links_resolve(self):
        for document in ROOT.rglob("*.md"):
            if "node_modules" in document.relative_to(ROOT).parts:
                continue
            text = document.read_text(encoding="utf-8")
            for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
                parsed = urlsplit(target)
                if parsed.scheme or parsed.netloc or not parsed.path:
                    continue
                with self.subTest(document=document.name, target=target):
                    resolved = (document.parent / unquote(parsed.path)).resolve()
                    self.assertTrue(resolved.is_relative_to(ROOT))
                    self.assertTrue(resolved.is_file())
                    if document.is_relative_to(SKILL):
                        self.assertTrue(resolved.is_relative_to(SKILL), "Copied skill must remain self-contained")

    def test_portable_skill_includes_license_and_brand_notice(self):
        self.assertEqual((ROOT / "LICENSE").read_bytes(), (SKILL / "LICENSE.txt").read_bytes())
        self.assertTrue((SKILL / "assets/NOTICE.md").is_file())
        text = (SKILL / "SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\nname: remote-computer-use\n"))
        self.assertIn("MCP mode is ON", " ".join(text.split()))
        self.assertIn("Those flags describe the controller only.", text)
        self.assertIn("ask and stop before connecting", text)
        self.assertIn("Target MCP mode is not required.", " ".join(text.split()))
        self.assertIn("Please turn on Remote Terminal", text)

    def test_svg_assets_are_self_contained(self):
        for asset in [*(SKILL / "assets").glob("*.svg"), *(ROOT / 'docs/assets').glob('*.svg')]:
            tree = ET.parse(asset)
            for node in tree.iter():
                with self.subTest(asset=asset.name):
                    self.assertNotIn(node.tag.split("}")[-1].lower(), ("script", "foreignobject", "image"))
                    for key, value in node.attrib.items():
                        self.assertFalse(key.lower().startswith("on"))
                        if key.endswith("href"):
                            self.assertTrue(value.startswith("#"))
                        self.assertNotRegex(value, r"url\(['\"]?https?://")

    def test_cover_is_expected_png(self):
        image = (ROOT / "docs/assets/remote-computer-use.png").read_bytes()
        self.assertEqual(image[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack(">II", image[16:24]), (1200, 630))
        self.assertLess(len(image), 1024 * 1024)

    def test_current_cover_uses_conditional_shell_requirement(self):
        cover = ROOT / 'docs/assets/remote-computer-use.svg'
        tree = ET.parse(cover)
        text = ' '.join(tree.getroot().itertext())
        self.assertIn('Shell only: Remote Terminal ON + in-app consent', text)
        self.assertIn('Target MCP is not required', text)
        self.assertEqual(tree.getroot().attrib['viewBox'], '0 0 1200 630')
        for readme in ['README.md', 'README.ko.md']:
            self.assertIn('src="docs/assets/remote-computer-use.svg"', (ROOT / readme).read_text())


if __name__ == "__main__":
    unittest.main()

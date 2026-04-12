"""
Image Synthesizer tool.

Converts images into a rich textual/numerical representation that non-vision
LLMs can understand.  Instead of sending raw pixels to a vision model, this
tool extracts metadata, dominant colours, spatial layout, text (OCR), edge
structure, and statistical summaries, then returns a structured JSON report
the LLM can reason over.
"""

import base64
import json
import logging
from pathlib import Path

from . import BaseTool, register_tool

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif",
}


@register_tool("image_synthesizer")
class ImageSynthesizerTool(BaseTool):
    name = "image_synthesizer"
    description = (
        "Convert an uploaded image into a rich textual and numerical "
        "representation that non-vision LLMs can understand. Extracts "
        "metadata, dominant colors, spatial layout, text (OCR), edge "
        "structure, brightness histogram, and region descriptions. "
        "Use this tool when the active model does not support vision "
        "and the user wants to discuss or analyse an image."
    )
    parameters = {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": (
                    "Name of the uploaded image file to synthesize "
                    "(e.g. 'photo.jpg', 'chart.png')."
                ),
            },
            "detail_level": {
                "type": "string",
                "enum": ["basic", "standard", "detailed"],
                "description": (
                    "Level of detail for the synthesis. "
                    "'basic' = metadata + colors, "
                    "'standard' (default) = adds OCR + histogram + edges, "
                    "'detailed' = adds region grid analysis."
                ),
            },
        },
        "required": ["filename"],
    }

    async def execute(self, **kwargs) -> str:
        filename = kwargs.get("filename", "")
        detail_level = kwargs.get("detail_level", "standard")

        upload_dir = Path(self.config.get("upload_dir", "./data/uploads"))
        filepath = upload_dir / filename

        if not filepath.exists():
            return json.dumps({"error": f"Image file not found: {filename}"})

        ext = filepath.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return json.dumps({
                "error": f"Unsupported image format '{ext}'. "
                         f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            })

        try:
            from PIL import Image
        except ImportError:
            return json.dumps({"error": "Pillow (PIL) not installed."})

        try:
            img = Image.open(filepath)
        except Exception as e:
            return json.dumps({"error": f"Failed to open image: {e}"})

        report = {}
        report["filename"] = filename
        report["format"] = img.format or ext.lstrip(".")
        report["mode"] = img.mode
        report["size"] = {"width": img.width, "height": img.height}
        report["aspect_ratio"] = round(img.width / max(img.height, 1), 3)

        # -- Metadata / EXIF --
        report["metadata"] = self._extract_metadata(img)

        # -- Dominant colours --
        report["dominant_colors"] = self._extract_dominant_colors(img)

        if detail_level in ("standard", "detailed"):
            # -- Brightness histogram --
            report["brightness_histogram"] = self._brightness_histogram(img)

            # -- Edge density (structural complexity) --
            report["edge_analysis"] = self._edge_analysis(img)

            # -- OCR text extraction --
            report["extracted_text"] = self._extract_text(filepath)

            # -- Color distribution --
            report["color_distribution"] = self._color_distribution(img)

        if detail_level == "detailed":
            # -- Region grid analysis (3x3 grid) --
            report["region_grid"] = self._region_grid_analysis(img)

        # Build a human-readable summary
        report["summary"] = self._build_summary(report, detail_level)

        return json.dumps(report, indent=2)

    # ----- helpers -----

    def _extract_metadata(self, img) -> dict:
        meta = {}
        try:
            exif = img.getexif()
            if exif:
                # Map common EXIF tag IDs to names
                tag_names = {
                    271: "make", 272: "model", 274: "orientation",
                    306: "datetime", 36867: "datetime_original",
                    37378: "aperture", 33434: "exposure_time",
                    34855: "iso", 37386: "focal_length",
                }
                for tag_id, name in tag_names.items():
                    val = exif.get(tag_id)
                    if val is not None:
                        meta[name] = str(val)
        except Exception:
            pass
        return meta

    def _extract_dominant_colors(self, img, n_colors=6) -> list:
        """Sample the image to find the most common colours."""
        try:
            # Resize for speed
            thumb = img.copy()
            thumb.thumbnail((80, 80))
            rgb = thumb.convert("RGB")
            pixels = list(rgb.getdata())

            # Quantise to reduce palette then count
            quantised = [
                (r // 32 * 32, g // 32 * 32, b // 32 * 32)
                for r, g, b in pixels
            ]
            from collections import Counter
            counts = Counter(quantised).most_common(n_colors)
            total = len(pixels)

            results = []
            for (r, g, b), count in counts:
                pct = round(count / total * 100, 1)
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                results.append({
                    "hex": hex_color,
                    "rgb": [r, g, b],
                    "percentage": pct,
                    "name": self._color_name(r, g, b),
                })
            return results
        except Exception as e:
            return [{"error": str(e)}]

    @staticmethod
    def _color_name(r, g, b) -> str:
        """Approximate a human-readable colour name."""
        brightness = (r + g + b) / 3
        if brightness < 30:
            return "black"
        if brightness > 225:
            return "white"

        max_c = max(r, g, b)
        min_c = min(r, g, b)
        diff = max_c - min_c
        if diff < 30:
            if brightness < 100:
                return "dark gray"
            if brightness < 180:
                return "gray"
            return "light gray"

        if r >= g and r >= b:
            if g > b + 40:
                return "yellow" if g > 150 else "orange"
            return "red"
        if g >= r and g >= b:
            if b > r + 40:
                return "cyan"
            return "green"
        if b >= r and b >= g:
            if r > g + 40:
                return "purple"
            return "blue"
        return "mixed"

    def _brightness_histogram(self, img, bins=10) -> dict:
        """Return a binned brightness histogram."""
        try:
            gray = img.convert("L")
            gray.thumbnail((200, 200))
            pixels = list(gray.getdata())
            total = len(pixels)

            bin_size = 256 // bins
            histogram = [0] * bins
            for p in pixels:
                idx = min(p // bin_size, bins - 1)
                histogram[idx] += 1

            histogram_pct = [round(c / total * 100, 1) for c in histogram]
            avg = round(sum(pixels) / total, 1)
            return {
                "average_brightness": avg,
                "brightness_0_255": "0=black,255=white",
                "histogram_bins": histogram_pct,
                "bin_ranges": [
                    f"{i * bin_size}-{min((i + 1) * bin_size - 1, 255)}"
                    for i in range(bins)
                ],
                "assessment": (
                    "very dark" if avg < 50 else
                    "dark" if avg < 100 else
                    "medium" if avg < 160 else
                    "bright" if avg < 210 else
                    "very bright"
                ),
            }
        except Exception as e:
            return {"error": str(e)}

    def _edge_analysis(self, img) -> dict:
        """Approximate edge density — how structurally complex the image is."""
        try:
            import numpy as np

            gray = img.convert("L")
            gray.thumbnail((150, 150))
            arr = np.array(gray, dtype=float)

            # Simple Sobel-like gradient magnitude
            dx = np.abs(np.diff(arr, axis=1))
            dy = np.abs(np.diff(arr, axis=0))

            avg_dx = float(np.mean(dx))
            avg_dy = float(np.mean(dy))
            edge_density = round((avg_dx + avg_dy) / 2, 2)

            return {
                "edge_density": edge_density,
                "horizontal_edges": round(avg_dx, 2),
                "vertical_edges": round(avg_dy, 2),
                "complexity": (
                    "very low (smooth/uniform)" if edge_density < 5 else
                    "low" if edge_density < 15 else
                    "medium" if edge_density < 30 else
                    "high" if edge_density < 50 else
                    "very high (complex/detailed)"
                ),
            }
        except ImportError:
            return {"note": "numpy not available for edge analysis"}
        except Exception as e:
            return {"error": str(e)}

    def _extract_text(self, filepath: Path) -> dict:
        """Try to extract text from the image via OCR."""
        try:
            import pytesseract
            from PIL import Image

            img = Image.open(filepath)
            text = pytesseract.image_to_string(img).strip()
            if text:
                return {
                    "found": True,
                    "text": text[:3000],  # limit for context
                    "char_count": len(text),
                }
            return {"found": False, "note": "No text detected in image"}
        except ImportError:
            return {"found": False, "note": "pytesseract not installed — OCR unavailable"}
        except Exception as e:
            return {"found": False, "error": str(e)}

    def _color_distribution(self, img) -> dict:
        """RGB channel statistics."""
        try:
            import numpy as np

            rgb = img.convert("RGB")
            rgb.thumbnail((100, 100))
            arr = np.array(rgb)

            channels = {}
            for i, name in enumerate(["red", "green", "blue"]):
                ch = arr[:, :, i].flatten()
                channels[name] = {
                    "mean": round(float(np.mean(ch)), 1),
                    "std": round(float(np.std(ch)), 1),
                    "min": int(np.min(ch)),
                    "max": int(np.max(ch)),
                }

            return channels
        except ImportError:
            return {"note": "numpy not available"}
        except Exception as e:
            return {"error": str(e)}

    def _region_grid_analysis(self, img, grid_size=3) -> list:
        """
        Split the image into a grid and describe each region.
        Returns a list of dicts with position, dominant colour and brightness.
        """
        try:
            import numpy as np

            rgb = img.convert("RGB")
            rgb.thumbnail((300, 300))
            arr = np.array(rgb)
            h, w = arr.shape[:2]
            rh = h // grid_size
            rw = w // grid_size

            regions = []
            for row in range(grid_size):
                for col in range(grid_size):
                    region = arr[
                        row * rh: (row + 1) * rh,
                        col * rw: (col + 1) * rw,
                    ]
                    avg_r = int(np.mean(region[:, :, 0]))
                    avg_g = int(np.mean(region[:, :, 1]))
                    avg_b = int(np.mean(region[:, :, 2]))
                    brightness = int((avg_r + avg_g + avg_b) / 3)

                    position_names = [
                        ["top-left", "top-center", "top-right"],
                        ["middle-left", "center", "middle-right"],
                        ["bottom-left", "bottom-center", "bottom-right"],
                    ]

                    regions.append({
                        "position": position_names[row][col],
                        "avg_color_rgb": [avg_r, avg_g, avg_b],
                        "avg_color_hex": f"#{avg_r:02x}{avg_g:02x}{avg_b:02x}",
                        "color_name": self._color_name(avg_r, avg_g, avg_b),
                        "brightness": brightness,
                    })

            return regions
        except ImportError:
            return [{"note": "numpy not available"}]
        except Exception as e:
            return [{"error": str(e)}]

    def _build_summary(self, report: dict, detail_level: str) -> str:
        """Build a human-readable summary paragraph."""
        parts = []

        sz = report["size"]
        parts.append(
            f"Image '{report['filename']}': {sz['width']}x{sz['height']} "
            f"{report['format'].upper()}, {report['mode']} mode."
        )

        # Dominant colors
        colors = report.get("dominant_colors", [])
        if colors and "error" not in colors[0]:
            top_colors = [
                f"{c['name']} ({c['hex']}, {c['percentage']}%)"
                for c in colors[:4]
            ]
            parts.append(f"Dominant colors: {', '.join(top_colors)}.")

        # Brightness
        hist = report.get("brightness_histogram")
        if hist and "error" not in hist:
            parts.append(
                f"Overall brightness: {hist['assessment']} "
                f"(avg {hist['average_brightness']}/255)."
            )

        # Edges
        edges = report.get("edge_analysis")
        if edges and "error" not in edges:
            parts.append(f"Visual complexity: {edges['complexity']}.")

        # OCR
        ocr = report.get("extracted_text")
        if ocr and ocr.get("found"):
            preview = ocr["text"][:200]
            parts.append(f"Detected text ({ocr['char_count']} chars): \"{preview}\"")

        # EXIF
        meta = report.get("metadata", {})
        if meta:
            meta_parts = [f"{k}={v}" for k, v in meta.items()]
            parts.append(f"EXIF: {', '.join(meta_parts)}.")

        return " ".join(parts)

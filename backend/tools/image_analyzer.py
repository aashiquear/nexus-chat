"""
Image Analyzer tool.

Accepts an uploaded image (JPEG, PNG, GIF, WebP) and sends it to the
configured LLM provider for vision-based analysis.  The LLM describes,
interprets, or answers questions about the image content.
"""

import base64
import json
import logging
from pathlib import Path

from . import BaseTool, register_tool

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"}

MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
}


@register_tool("image_analyzer")
class ImageAnalyzerTool(BaseTool):
    name = "image_analyzer"
    description = (
        "Analyze an uploaded image using AI vision. Provide the filename of an "
        "uploaded image (JPEG, PNG, GIF, WebP, BMP, TIFF) and optionally a "
        "question or instruction about what to analyze. The tool returns a "
        "detailed description and analysis of the image content."
    )
    parameters = {
        "type": "object",
        "properties": {
            "filename": {
                "type": "string",
                "description": (
                    "Name of the uploaded image file to analyze "
                    "(e.g. 'photo.jpg', 'diagram.png')."
                ),
            },
            "question": {
                "type": "string",
                "description": (
                    "Optional question or instruction about the image, e.g. "
                    "'What objects are in this image?', 'Describe the chart', "
                    "'Extract any text visible'."
                ),
            },
        },
        "required": ["filename"],
    }

    async def execute(self, **kwargs) -> str:
        filename = kwargs.get("filename", "")
        question = kwargs.get("question", "Analyze this image in detail. Describe what you see, any text, objects, patterns, or notable features.")

        upload_dir = Path(self.config.get("upload_dir", "./data/uploads"))
        filepath = upload_dir / filename

        if not filepath.exists():
            return json.dumps({"error": f"Image file not found: {filename}"})

        ext = filepath.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return json.dumps({
                "error": f"Unsupported image format '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            })

        # Read and base64-encode the image
        image_bytes = filepath.read_bytes()
        b64_data = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = MIME_MAP.get(ext, "image/png")

        # Try Anthropic first, then OpenAI
        analysis = await self._analyze_with_anthropic(b64_data, mime_type, question)
        if analysis is None:
            analysis = await self._analyze_with_openai(b64_data, mime_type, question)
        if analysis is None:
            return json.dumps({
                "error": "No vision-capable LLM provider is available. Configure an Anthropic or OpenAI API key."
            })

        return json.dumps({
            "filename": filename,
            "analysis": analysis,
            "question": question,
        })

    async def _analyze_with_anthropic(self, b64_data: str, mime_type: str, question: str) -> str | None:
        """Use Anthropic Claude for vision analysis."""
        try:
            import anthropic
            import os

            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            if not api_key or api_key.startswith("${"):
                return None

            client = anthropic.AsyncAnthropic(api_key=api_key)
            message = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": mime_type,
                                    "data": b64_data,
                                },
                            },
                            {
                                "type": "text",
                                "text": question,
                            },
                        ],
                    }
                ],
            )
            return message.content[0].text
        except Exception as e:
            logger.warning(f"Anthropic vision failed: {e}")
            return None

    async def _analyze_with_openai(self, b64_data: str, mime_type: str, question: str) -> str | None:
        """Use OpenAI GPT-4o for vision analysis."""
        try:
            from openai import AsyncOpenAI
            import os

            api_key = os.environ.get("OPENAI_API_KEY", "")
            if not api_key or api_key.startswith("${"):
                return None

            client = AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model="gpt-4o",
                max_tokens=2048,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{b64_data}",
                                },
                            },
                            {
                                "type": "text",
                                "text": question,
                            },
                        ],
                    }
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"OpenAI vision failed: {e}")
            return None

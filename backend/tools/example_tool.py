"""
Example: How to create a custom tool for Nexus Chat.

Steps:
  1. Create a new .py file in backend/tools/ (or add to this file)
  2. Import BaseTool and register_tool from the tools package
  3. Subclass BaseTool and implement execute()
  4. Add the tool entry in config/settings.yaml
  5. Import the file in backend/main.py

That's it! The tool will appear in the UI sidebar.
"""

import json
from . import BaseTool, register_tool


@register_tool("weather")
class WeatherTool(BaseTool):
    """Example: A weather lookup tool (stub - replace with real API)."""

    name = "weather"
    description = "Get current weather for a location"

    # JSON Schema describing the tool's parameters
    parameters = {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City name or coordinates, e.g. 'Denver, CO'"
            },
            "units": {
                "type": "string",
                "enum": ["fahrenheit", "celsius"],
                "description": "Temperature units",
                "default": "fahrenheit"
            }
        },
        "required": ["location"]
    }

    async def execute(self, **kwargs) -> str:
        """
        Execute the tool. Must return a JSON string.

        Access config values via self.config (set in settings.yaml).
        """
        location = kwargs.get("location", "Unknown")
        units = kwargs.get("units", "fahrenheit")

        # --- Replace this stub with a real weather API call ---
        # Example using self.config:
        #   api_key = self.config.get("api_key")
        #   async with httpx.AsyncClient() as client:
        #       resp = await client.get(f"https://api.weather.com/...", params={...})
        #       data = resp.json()

        return json.dumps({
            "location": location,
            "temperature": 72 if units == "fahrenheit" else 22,
            "units": units,
            "condition": "Sunny",
            "note": "This is a stub. Replace with a real weather API.",
        })

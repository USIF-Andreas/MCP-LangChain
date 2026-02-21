# ============================================================
# mcp_server.py  —  A simple MCP server exposing 3 tools
# ============================================================
# Install deps:
#   pip install mcp
#
# Run this server before starting the agent:
#   python mcp_server.py
# ============================================================

import json
import random
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp import types

# Create the MCP server instance
app = Server("demo-tools-server")


# ── Tool 1: Get fake weather ──────────────────────────────────
@app.list_tools()
async def list_tools() -> list[types.Tool]:
    """Tell clients which tools this server exposes."""
    return [
        types.Tool(
            name="get_weather",
            description="Get the current weather for a given city.",
            inputSchema={
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The city name, e.g. 'Cairo' or 'London'",
                    }
                },
                "required": ["city"],
            },
        ),
        types.Tool(
            name="calculate",
            description="Perform a basic math calculation. Supports +, -, *, /",
            inputSchema={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "A math expression like '12 * 8' or '100 / 4'",
                    }
                },
                "required": ["expression"],
            },
        ),
        types.Tool(
            name="save_note",
            description="Save a text note to a local file called notes.txt",
            inputSchema={
                "type": "object",
                "properties": {
                    "note": {
                        "type": "string",
                        "description": "The text content to save",
                    }
                },
                "required": ["note"],
            },
        ),
    ]


# ── Tool implementations ──────────────────────────────────────
@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:

    if name == "get_weather":
        city = arguments["city"]
        # In a real server you'd call a weather API here
        conditions = ["sunny ☀️", "cloudy ⛅", "rainy 🌧️", "windy 💨"]
        temp = random.randint(15, 38)
        result = f"Weather in {city}: {random.choice(conditions)}, {temp}°C"
        return [types.TextContent(type="text", text=result)]

    elif name == "calculate":
        expression = arguments["expression"]
        try:
            # Safe eval for basic math only
            allowed = set("0123456789+-*/()., ")
            if not all(c in allowed for c in expression):
                raise ValueError("Only basic math operators allowed")
            result = eval(expression)  # noqa: S307
            return [types.TextContent(type="text", text=f"{expression} = {result}")]
        except Exception as e:
            return [types.TextContent(type="text", text=f"Error: {e}")]

    elif name == "save_note":
        note = arguments["note"]
        with open("notes.txt", "a") as f:
            f.write(note + "\n")
        return [types.TextContent(type="text", text="Note saved to notes.txt ✅")]

    else:
        return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


# ── Entry point ───────────────────────────────────────────────
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
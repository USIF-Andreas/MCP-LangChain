import os
import json
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

server_params = StdioServerParameters(
    command="python",
    args=["mcp_server.py"],
)

SYSTEM_PROMPT = """You are a helpful assistant with access to tools.
IMPORTANT RULES:
- Call tools ONE at a time, never pass a list as an argument
- If asked about multiple cities, call get_weather once per city separately
- Each tool argument must be a single string, not a list or array
"""

def get_llm(provider: str, model: str | None = None):
    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(model=model or "llama3.2", temperature=0)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model or "claude-haiku-4-5-20251001", temperature=0)
    raise ValueError(f"Unknown provider: {provider}")

class ChatRequest(BaseModel):
    message: str
    provider: str = "ollama"
    model: str | None = None

@app.post("/chat")
async def chat(req: ChatRequest):
    async def generate():
        try:
            llm = get_llm(req.provider, req.model)

            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools = await load_mcp_tools(session)

                    yield f"data: {json.dumps({'type': 'tools', 'tools': [t.name for t in tools]})}\n\n"

                    agent = create_react_agent(llm, tools, prompt=SYSTEM_PROMPT)

                    result = await agent.ainvoke({
                        "messages": [{"role": "user", "content": req.message}]
                    })

                    for msg in result["messages"]:
                        msg_type = type(msg).__name__

                        if msg_type == "AIMessage" and hasattr(msg, "tool_calls") and msg.tool_calls:
                            for tc in msg.tool_calls:
                                yield f"data: {json.dumps({'type': 'tool_call', 'tool': tc['name'], 'args': tc['args']})}\n\n"

                        elif msg_type == "ToolMessage":
                            yield f"data: {json.dumps({'type': 'tool_result', 'tool': msg.name, 'result': str(msg.content)})}\n\n"

                        elif msg_type == "AIMessage" and msg.content and not getattr(msg, "tool_calls", None):
                            words = str(msg.content).split(" ")
                            for word in words:
                                yield f"data: {json.dumps({'type': 'token', 'text': word + ' '})}\n\n"

                    yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/check-anthropic")
async def check_anthropic():
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    return {"ok": bool(key and key.startswith("sk-ant-"))}

@app.get("/check-ollama")
async def check_ollama():
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:11434/api/tags", timeout=3)
            data = r.json()
            models = [m["name"].split(":")[0] for m in data.get("models", [])]
            return {"ok": True, "models": models}
    except Exception:
        return {"ok": False, "models": []}
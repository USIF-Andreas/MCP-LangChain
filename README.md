# LangChain + MCP Agent — Example Project

## How it works

```
┌─────────────────────────────────────────────────────────┐
│                      agent.py                           │
│                                                         │
│  User message                                           │
│      │                                                  │
│      ▼                                                  │
│  LangChain AgentExecutor                                │
│      │                                                  │
│      ├── ChatOpenAI (GPT-4o-mini)  ← decides what to do│
│      │                                                  │
│      └── MCP Tools (via langchain-mcp-adapters)         │
│              │                                          │
│              │  stdio (subprocess)                      │
│              ▼                                          │
│         mcp_server.py                                   │
│              │                                          │
│              ├── get_weather(city)                      │
│              ├── calculate(expression)                  │
│              └── save_note(note)                        │
└─────────────────────────────────────────────────────────┘
```

## Setup

```bash
pip install langchain langchain-openai langchain-mcp-adapters mcp
export OPENAI_API_KEY="sk-..."
```

## Run

```bash
python agent.py
```

## Key concepts

| Concept | File | Role |
|---|---|---|
| MCP Server | `mcp_server.py` | Exposes tools using the MCP standard |
| MCP Client | inside `agent.py` | Connects to server, loads tool definitions |
| LangChain Adapter | `load_mcp_tools()` | Converts MCP tools → LangChain Tool objects |
| LangChain Agent | `agent.py` | Orchestrates LLM + tool calls in a loop |
| AgentExecutor | `agent.py` | Runs the think→act→observe loop |

## What happens step by step

1. `agent.py` starts `mcp_server.py` as a **subprocess** over stdio
2. MCP handshake happens — client discovers available tools
3. `load_mcp_tools()` wraps them as LangChain tools
4. User message goes to the LangChain agent
5. LLM decides which tools to call and with what arguments
6. Tool calls are forwarded to the MCP server
7. MCP server runs the tool and returns results
8. LLM sees the results and decides next step (more tools or final answer)
9. Final answer is returned to the user

## Swap the LLM

```python
# Use Anthropic Claude instead of OpenAI
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-sonnet-4-20250514")

# Use a local model via Ollama
from langchain_ollama import ChatOllama
llm = ChatOllama(model="llama3.2")
```

## Swap to a remote MCP server (HTTP/SSE)

```python
from mcp.client.sse import sse_client

async with sse_client("http://localhost:8000/sse") as (read, write):
    async with ClientSession(read, write) as session:
        # same code from here...
```
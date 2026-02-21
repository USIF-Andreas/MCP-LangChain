# ============================================================
# agent.py  —  LangChain + LangGraph + MCP agent
# Fixed: updated import + system prompt for local models
# ============================================================
# Run:
#   export ANTHROPIC_API_KEY="sk-ant-..."   # if using anthropic
#   python agent.py --provider ollama
#   python agent.py --provider anthropic
# ============================================================

import asyncio
import argparse
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain.agents import create_react_agent          # ✅ fixed import
from langchain import hub
from langchain_core.prompts import ChatPromptTemplate
from langgraph.prebuilt import create_react_agent as create_graph_agent


def get_llm(provider: str, model: str | None):
    if provider == "ollama":
        from langchain_ollama import ChatOllama
        model_name = model or "llama3.2"
        print(f"🦙 Using Ollama model: {model_name}")
        return ChatOllama(model=model_name, temperature=0)
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        model_name = model or "claude-haiku-4-5-20251001"
        print(f"🤖 Using Anthropic model: {model_name}")
        return ChatAnthropic(model=model_name, temperature=0)
    else:
        raise ValueError(f"Unknown provider: {provider}")


server_params = StdioServerParameters(
    command="python",
    args=["mcp_server.py"],
)

# System prompt that tells local models to call tools ONE at a time
SYSTEM_PROMPT = """You are a helpful assistant with access to tools.

IMPORTANT RULES:
- Call tools ONE at a time, never pass a list as an argument
- If asked about multiple cities, call get_weather once per city separately  
- Each tool argument must be a single string, not a list or array
- After all tool calls are done, summarize the results clearly
"""


async def run_agent(user_message: str, llm):
    print(f"\n{'='*55}")
    print(f"User: {user_message}")
    print(f"{'='*55}")

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await load_mcp_tools(session)
            print(f"✅ Loaded MCP tools: {[t.name for t in tools]}\n")

            # create_graph_agent from langgraph.prebuilt still works,
            # just pass system_prompt to avoid the deprecation path
            agent = create_graph_agent(
                llm,
                tools,
                prompt=SYSTEM_PROMPT,   # guides local models to use tools correctly
            )

            result = await agent.ainvoke({
                "messages": [{"role": "user", "content": user_message}]
            })

            final = result["messages"][-1].content
            print(f"\n🤖 Answer: {final}\n")
            return final


async def main(provider: str, model: str | None):
    llm = get_llm(provider, model)

    await run_agent("What is the weather in Cairo? And what is the weather in Tokyo?", llm)
    await run_agent("What is 1337 * 42?", llm)
    await run_agent(
        "Get the weather in London. Then calculate 25 * 4. "
        "Then save a note: 'Agent run completed!'",
        llm,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["ollama", "anthropic"], default="ollama")
    parser.add_argument("--model", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.provider, args.model))
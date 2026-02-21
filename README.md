# 🤖 LangChain × MCP Agent

![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![LangChain](https://img.shields.io/badge/LangChain-1.x-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-local-black?style=for-the-badge&logo=ollama&logoColor=white)
![Anthropic](https://img.shields.io/badge/Anthropic-Claude-D97706?style=for-the-badge&logo=anthropic&logoColor=white)

A full-stack AI agent connecting a **React UI** → **FastAPI** → **LangGraph agent** → **MCP tools**, running on local Ollama models or Anthropic Claude.

---

## 🏗️ Architecture

```
🌐 React UI (Vite)
      │
      │  HTTP / SSE streaming
      ▼
⚡ FastAPI Backend
      │
      ├── 🧠 LangGraph Agent (create_react_agent)
      │         └── 🦙 Ollama  or  🤖 Anthropic
      │
      └── 🔌 MCP Client
                │  stdio
                ▼
          🛠️ MCP Server
                ├── ⛅ get_weather(city)
                ├── 🧮 calculate(expression)
                └── 📝 save_note(note)
```

---

## 📁 Project Structure

```
MCP-LangChain/
├── 🐍 mcp_server.py     — MCP server with 3 tools
├── 🐍 backend.py        — FastAPI + LangGraph agent
├── 🐍 agent.py          — CLI agent (no UI)
└── ⚛️  frontend/
    └── src/
        └── App.jsx      — React chat UI
```

---

## ⚙️ Prerequisites

| | Tool | Version |
|--|------|---------|
| 🐍 | Python | 3.12+ |
| 📦 | Node.js | 18+ |
| 🦙 | Ollama | latest |

---

## 🚀 Quick Start

### 1️⃣ Install dependencies

```bash
pip install fastapi uvicorn langchain langchain-ollama \
            langchain-anthropic langchain-mcp-adapters \
            mcp langgraph httpx
```

### 2️⃣ Pull a model

```bash
ollama pull llama3.2      # 2GB — fast
ollama pull qwen2.5       # best tool-calling
ollama pull mistral       # great all-rounder
```

### 3️⃣ Start all 3 services

| Terminal | Command |
|----------|---------|
| 🦙 **Ollama** | `OLLAMA_HOST=0.0.0.0 ollama serve` |
| ⚡ **Backend** | `uvicorn backend:app --reload --port 8000` |
| 🌐 **Frontend** | `cd frontend && npm install && npm run dev` |

Open 👉 **http://localhost:5173**

---

## 🔌 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/chat` | Run agent · streams SSE |
| `GET` | `/health` | Backend alive check |
| `GET` | `/check-ollama` | Ollama status + models |
| `GET` | `/check-anthropic` | API key check |

---

## 🛠️ MCP Tools

| Icon | Tool | Input | What it does |
|------|------|-------|-------------|
| ⛅ | `get_weather` | `city: str` | Fake weather for any city |
| 🧮 | `calculate` | `expression: str` | Math — `"12 * 8"` → `96` |
| 📝 | `save_note` | `note: str` | Appends to `notes.txt` |

---

## 🧠 LLM Providers

### 🦙 Ollama — free, local, private

```bash
python agent.py --provider ollama --model llama3.2
python agent.py --provider ollama --model qwen2.5
```

### 🤖 Anthropic Claude — cloud

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
python agent.py --provider anthropic --model claude-haiku-4-5-20251001
```

---

## 🖥️ UI Features

| | Feature |
|--|---------|
| 🟢 | Live status dots — backend, Ollama, API key |
| ⚠️ | Warning banner with exact fix command |
| 🔧 | Tool call + result cards shown in real time |
| ✨ | Answer streams word by word |
| 🔄 | Switch provider/model from the UI |
| 🚫 | Input locked until all services are green |

---

## ☁️ GitHub Codespaces

```bash
# 1. Set ports 8000 and 11434 to Public in the Ports tab
# 2. Update URLs in App.jsx:
sed -i 's|http://localhost:8000|https://YOUR-CODESPACE-8000.app.github.dev|g' frontend/src/App.jsx
sed -i 's|http://localhost:11434|https://YOUR-CODESPACE-11434.app.github.dev|g' frontend/src/App.jsx
```

---

## 🐛 Troubleshooting

| ❌ Error | 💡 Fix |
|---------|--------|
| `Could not import module "backend"` | Run uvicorn from project root |
| `TaskGroup unhandled error` | Restart the backend |
| `list is not of type string` | Ask about one city at a time |
| Ollama dot stays 🔴 | Start with `OLLAMA_HOST=0.0.0.0 ollama serve` |
| Black screen | Remove `App.css` / `index.css` imports from `main.jsx` |
| 403 on Codespaces | Set ports to **Public** in Ports tab |

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| 🎨 **Frontend** | React 18 · Vite · CSS-in-JS |
| ⚡ **Backend** | FastAPI · Uvicorn · SSE |
| 🧠 **Agent** | LangChain · LangGraph · `create_react_agent` |
| 🔌 **Tools** | MCP — Model Context Protocol |
| 🦙 **Local LLM** | Ollama — llama3.2 · qwen2.5 · mistral |
| ☁️ **Cloud LLM** | Anthropic — Claude Haiku · Sonnet |

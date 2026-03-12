# ShadowDB 🚀

**ShadowDB** is a high-performance, privacy-first semantic file search engine. It monitors your local filesystem in real-time and provides a web-based dashboard for semantic search and AI-driven query reasoning.

## 🏗️ Architecture

- **Watcher (Rust)**: A high-performance background service that monitors file system events (Create, Modify, Delete) using the `notify` crate.
- **Web (Next.js 16)**: A modern dashboard for searching and indexing documents.
- **Database (LanceDB)**: An open-source vector database for lightning-fast semantic retrieval.
- **LLM (Ollama/Transformers.js)**: Local AI models for generating embeddings and synthesizing answers.

## 🚀 Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Ollama](https://ollama.com/) (for query synthesis)

### Launching the system

Run the provided launcher script:

```bash
chmod +x start.sh
./start.sh [PATH_TO_WATCH]
```

By default, it watches `../test-docs`.

## 🛠️ Tech Stack

- **Backend**: Rust, Serde, Reqwest
- **Frontend**: Next.js 16, TypeScript, Framer Motion, Leaflet
- **AI**: Google Gemini (optional), Ollama (Llama 3.2), Transformers.js
- **Vector Store**: LanceDB

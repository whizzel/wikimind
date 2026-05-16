# WikiMind · Knowledge Compiler

WikiMind is a "Build your own Wikipedia" engine. You enter any topic, and WikiMind fetches real sources, ingests them into HydraDB's context graph, and compiles a living, highly-structured knowledge article that compounds with every question you ask.

## Features

- **Automated Ingestion**: Enter a topic (or a custom URL) and WikiMind automatically scrapes the source (using the Wikipedia API or direct URLs) and ingests it.
- **Graph-Powered Context**: Uses HydraDB to build a rich entity-relationship graph. Instead of just basic semantic search, it finds what's useful through graph-first retrieval.
- **Dynamic Compilation**: Generates a beautiful, multi-section Wikipedia-style article using fast LLM inference (via Groq).
- **Interactive Visualization**: Features an interactive, force-directed graph (using `react-force-graph-2d`) that lets you visually explore entity relationships.
- **Server-Side Persistence**: Articles are saved securely on the server, allowing you to reload the page or share URLs seamlessly.
- **Premium UX**: Smooth, animated transitions using `framer-motion` and reliable, real-time Server-Sent Events (SSE) streaming via `@microsoft/fetch-event-source`.

## Architecture & Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Knowledge Graph & RAG**: HydraDB
- **LLM Integration**: [Groq](https://groq.com/) for lightning-fast inference
- **Graph Visualization**: `react-force-graph-2d`

### The Pipeline Flow

The core architecture revolves around a 6-step data pipeline (`src/lib/pipeline.ts`):

1. **Fetch**: The user enters a topic. The system fetches the corresponding Wikipedia article (or a custom URL).
2. **Chunk & Ingest**: The raw text content is sent to HydraDB for chunking and ingestion.
3. **Graph Processing**: HydraDB extracts entities and maps relationships in the background. The app securely polls the `verify_processing` API until completion.
4. **Recall**: The app retrieves the synthesized graph context and relationships for the topic.
5. **Generate**: The rich context is fed into the LLM via `src/lib/generate.ts` to compile the final article markdown.
6. **Persist & Display**: The article is saved to local storage (`.data/articles.json`) and instantly presented in the UI.

## Getting Started

### Prerequisites

1. Node.js 18+
2. A HydraDB API Key
3. A Groq API Key

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables. Create a `.env` file in the root directory:
   ```env
   HYDRA_DB_API_KEY=your_hydradb_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) and start compiling knowledge!

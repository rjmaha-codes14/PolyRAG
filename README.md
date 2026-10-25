# PolyRAG — Multilingual AI Assistant & Document Intelligence

> **Understands your documents. Speaks your language. Cites its sources.**

PolyRAG is a production-quality AI chatbot with retrieval-augmented generation (RAG) support for all **22 scheduled Indian languages + English**. It answers accurately from uploaded documents with page-level citations `[1]`, `[2]`, and honestly says *"I couldn't find this in the documents"* when information is absent. Built specifically for students, enterprises, and public offices navigating India's linguistic diversity.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Next.js 14 App Client (Browser)"]
        UI["Chat Area / Sidebar / Library / Modals"]
        SSE["SSE Stream Receiver (fetch + ReadableStream)"]
        I18N["i18n Translation Engine (12 Indic Languages)"]
    end

    subgraph Server["Next.js Server (App Router)"]
        Auth["Auth & Rate Limiting (bcrypt + jose JWT)"]
        Router["Smart Router (lib/smart-routing.ts)"]
        LangDetect["Parallel Language & Script Detector"]
        Hybrid["Hybrid Search (Cosine Vector + BM25)"]
        DocIngest["Doc Parser & Chunking Engine (pdf-parse / mammoth / OCR)"]
    end

    subgraph Gemini["Google Gemini API"]
        LLM["Gemini 1.5 Flash (Streaming Responses & JSON mode)"]
        Embeddings["text-embedding-004 (Batch Embeddings)"]
        VisionOCR["Gemini Vision OCR (Indic Scans & Images)"]
    end

    subgraph DB["PostgreSQL (Neon) + Prisma"]
        Postgres[("Neon Serverless PostgreSQL (Users, Chats, Chunks, Embeddings as Bytes)")]
    end

    UI -->|HTTP POST| Server
    Server --> Auth
    Auth --> Router
    Router -->|Parallel| LangDetect
    Router -->|Parallel| Hybrid
    LangDetect -->|JSON Disambiguation| LLM
    Hybrid -->|Float32 Cosine Search| Postgres
    DocIngest -->|Batch Embeddings| Embeddings
    DocIngest -->|Scanned Pages / Images| VisionOCR
    DocIngest -->|Store Chunks & Embeddings| Postgres
    Hybrid -->|Top Chunks as DATA Context| LLM
    LLM -->|Token-by-Token SSE Stream| SSE
    SSE --> UI
```

---

## ✨ Key Capabilities

| Feature | Detail |
|---|---|
| 🌐 **All 22 Scheduled Languages** | Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, Urdu, Assamese, Maithili, Santali, Kashmiri, Sindhi, Dogri, Manipuri (Meitei), Bodo, Santhali, Konkani, Sanskrit + English (& romanized Hinglish/Tanglish) |
| 📄 **Document RAG** | Upload PDF, DOCX, TXT, MD, or scanned images. Answers strictly cite pages `[1]`, `[2]` with a clickable Sources drawer |
| 🔍 **Hybrid Retrieval** | Semantic embeddings (Gemini `text-embedding-004`) + BM25 keyword matching + neighbor chunk expansion |
| 🏠 **Honest Fallback** | If documents do not contain the answer, PolyRAG honestly declines to invent facts |
| ⚡ **Low Latency Streaming** | Real-time token-by-token streaming via Server-Sent Events (SSE) with typing indicators |
| 🔐 **Self-Contained Auth** | bcrypt password hashing + jose JWT in httpOnly cookies, rate-limiting (5 attempts / 15 min) |
| 🌓 **Theme & Typography** | Dark/light/system theme, customizable font sizes, RTL layout for Urdu/Kashmiri/Sindhi/Arabic |
| 💾 **Persistent Chat History** | Conversation history saved in PostgreSQL (Neon) via Prisma, with auto-generated titles |
| 📤 **Export & Share** | Download chats as Markdown, Web Share API support |
| 🏥 **Zero-Downtime Health** | Self-test on startup and at `/api/health` displaying actionable alerts if API key is invalid |

---

## 🔀 Smart Routing Modes

Every user query is routed through an autonomous classification engine:

1. **General Chat**: Casual or world-knowledge queries (e.g., *"Write a short poem about rain"*). Answered directly by Gemini without document retrieval or citations.
2. **Document RAG**: When documents are attached or query matches uploaded documents above similarity threshold. Injected strictly as **DATA** with inline citations `[1]`, `[2]`.
3. **Honest "Not Found" Fallback**: When user asks about their document but relevant context is missing. Replies honestly in user's language: *"I couldn't find this in your documents"* and offers general knowledge.

---

## 🌍 Language Support & Real-World Quality Note

> **Note on Model Quality**:
> Quality and fluency are strongest for high-resource languages (English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Malayalam, Kannada, Punjabi, Urdu, Odia). For lower-resource languages (Bodo, Dogri, Kashmiri, Santali, Manipuri, Sanskrit), translation fidelity and comprehension depend on the underlying Gemini model training data. PolyRAG provides script-level Unicode detection and fallback heuristics to maximize accuracy across all 22 languages.

---

## 🎯 UN Sustainable Development Goals (SDG) Alignment

PolyRAG directly supports the United Nations Sustainable Development Goals:

- **SDG 4: Quality Education** — Democratizes access to complex textbooks, study materials, and government educational schemes in the learner's mother tongue.
- **SDG 8: Decent Work & Economic Growth** — Equips workers and small business owners across India to digest technical contracts, legal terms, and operational manuals without language barriers.
- **SDG 9: Industry, Innovation & Infrastructure** — Provides sovereign, local-first document intelligence infrastructure without requiring expensive cloud vector databases.
- **SDG 10: Reduced Inequalities** — Eliminates the linguistic digital divide, enabling non-English speakers equal access to AI intelligence.
- **SDG 16: Peace, Justice & Strong Institutions** — Empowers citizens to read and question legal notifications, court orders, and civic notices in public offices with verifiable citations.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js ≥ 18.0.0
- Google Gemini API key ([Get one free from Google AI Studio](https://aistudio.google.com/app/apikey))
- Neon Serverless PostgreSQL Database ([Create free account at neon.tech](https://neon.tech))

---

## 🐘 Setting Up Free Neon PostgreSQL Database

1. **Sign Up / Log In**: Go to **[https://neon.tech](https://neon.tech)** and sign in with GitHub or Google.
2. **Create a Project**:
   - Click **Create Project** or **New Project**.
   - Name your project (e.g., `polyrag-db`).
   - Select Postgres version (PostgreSQL 16 or 15 recommended).
   - Choose a region closest to your Vercel deployment (e.g., `AWS us-east-2` or `AWS us-east-1`).
   - Click **Create Project**.
3. **Copy the Connection String**:
   - On the Neon Project Dashboard, locate the **Connection Details** box.
   - Choose **Prisma** or **Pooled connection** from the dropdown.
   - Copy the connection string. It will look like:
     ```
     postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-123456.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - **Tip**: Append `&connect_timeout=30` to allow sufficient time for Neon's serverless compute to wake up on cold starts:
     ```
     postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-123456.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30
     ```

---

### 1. Installation
```powershell
git clone <repo-url>
cd PolyRAG
npm install
```

### 2. Configure Environment
Create or edit `.env`:
```env
GEMINI_API_KEY="AIzaSy..."   # Replace with your actual Gemini API Key
GEMINI_MODEL="gemini-1.5-flash"
GEMINI_EMBED_MODEL="text-embedding-004"
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz-123456.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30"
JWT_SECRET="polyrag-enterprise-secure-jwt-secret-key-32chars"
NODE_ENV="development"
```

### 3. Sync Database Schema & Seed Demo User
```powershell
npx prisma db push
npm run seed
```

### 4. Run the App Locally
```powershell
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ☁️ Deploying to Vercel

1. Push your repository to GitHub / GitLab / Bitbucket.
2. In the [Vercel Dashboard](https://vercel.com/new), import your PolyRAG repository.
3. In **Project Settings > Environment Variables**, add the following:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string (with `?sslmode=require&connect_timeout=30`)
   - `GEMINI_API_KEY`: Your Google Gemini API Key
   - `GEMINI_MODEL`: `gemini-1.5-flash`
   - `GEMINI_EMBED_MODEL`: `text-embedding-004`
   - `JWT_SECRET`: Random 32+ character string
   - `NODE_ENV`: `production`
4. Click **Deploy**. Vercel will automatically run `npm run build` (`prisma generate && next build`) and launch the application.

---

## 🧪 Demo Credentials & Step-by-Step Walkthrough

### Default Credentials
- **Email**: `demo@polyrag.ai`
- **Password**: `Demo@12345`

### Acceptance Test Steps
1. **Login & Session**: Open `/login`, log in with the demo account. Toggle password visibility with the eye icon.
2. **General Multilingual Chat**: Send "hi", "வணக்கம்" (Tamil), "నమస్కారం" (Telugu), "नमस्ते" (Hindi), or "Kaise ho?" (Hinglish). Notice instant streamed replies in the matching script with language badges.
3. **General Creativity**: Ask *"Write a short poem about rain"* to verify general chat mode.
4. **Document Ingestion**: Click the `+` icon or Document Library, upload a PDF/DOCX. Observe live processing status changing to `ready`.
5. **Citations in Action**: Ask a question specific to the uploaded file. See inline citations `[1]`, `[2]` and click the Sources panel to inspect page excerpts.
6. **Cross-Language RAG**: Ask in Hindi about an English policy document; receive an accurate Hindi response citing the English pages.
7. **Honest Fallback**: Ask a question not mentioned in the document. PolyRAG will state it cannot find the information in your document.
8. **Document Actions**: Open Document Library, click Quick Actions (Summarize, Key Points, Action Items, Translate).
9. **UI & Theme**: Open Settings, switch between Light and Dark themes, change interface language, export conversation to Markdown.

---

## 🛠️ Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Start Next.js App Router development server |
| `npm run build` | Generate Prisma client and build production-optimized application |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint type and style validation |
| `npm run seed` | Seed demo user (`demo@polyrag.ai`) into PostgreSQL |

---

## 📄 License

MIT License. Designed and built for India's linguistic diversity.

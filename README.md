# 🌐 PolyRAG — Multilingual AI Document Assistant

> Understands your documents. Speaks your language. Cites its sources.

🔑 Demo login: `demo@polyrag.ai` / `Demo@12345`

## 💡 What is PolyRAG?
A chatbot that answers from your uploaded documents in **22 Indian languages + English**, with page citations. If the answer isn't in the document, it says so honestly.

## ✨ Key Features
- 🗣️ Chat in Tamil, Hindi, Telugu and all 22 scheduled Indian languages + English
- 📄 Upload PDF, DOCX, TXT or scanned images
- 📌 Answers with citations `[1]`, `[2]` and a Sources panel
- 🔍 Hybrid search (semantic + keyword)
- 🚫 Honest "not found" instead of made-up answers
- ⚡ Real-time streaming replies
- 🔐 Secure login (bcrypt + JWT)
- 💾 Saved chat history, export to Markdown
- 🌓 Dark/light theme, RTL support (Urdu etc.)

## 🛠️ Tech Stack
- ⚛️ Next.js 14 + TypeScript + Tailwind CSS
- 🗄️ PostgreSQL (Neon) + Prisma
- 🤖 Google Gemini API (chat, embeddings, OCR)
- ☁️ Deployed on Vercel

## 🌍 SDG Alignment
- 🎓 SDG 4: Quality Education
- ⚖️ SDG 10: Reduced Inequalities
- 🏗️ SDG 9: Industry, Innovation & Infrastructure

## ⚙️ Run Locally
```bash
git clone <repo-url>
cd PolyRAG
npm install
```
Create a `.env` file (see `.env.example`):
```env
GEMINI_API_KEY="your_key_here"
GEMINI_MODEL="a_current_gemini_model"
GEMINI_EMBED_MODEL="your_embedding_model"
DATABASE_URL="your_neon_postgres_url"
JWT_SECRET="any_long_random_string"
```
Then:
```bash
npx prisma db push
npm run seed
npm run dev
```
Open http://localhost:3000

## 🔗 Live Demo
👉 **https://poly-rag-t3dz.vercel.app/**


## 👩‍💻 Author
**Maha R J** — IBM SkillsBuild × BharatCares (AICTE) Internship

# VoiceFlow Pro: Executive Summary & Technical Overview

## 🎯 Purpose
VoiceFlow Pro is a professional-grade, privacy-first desktop application designed for advanced audio and video transcription. It caters to professionals—such as lawyers, journalists, therapists, and corporate researchers—who require absolute data confidentiality. It delivers powerful AI workflows without forcing users to upload sensitive information to third-party cloud services.

## 🛡️ Core Value Proposition: Local Privacy
Unlike dominant cloud-based services (e.g., Otter.ai, Descript), VoiceFlow Pro executes its most intensive processing **locally**. By decoding media natively via FFmpeg and running transcription through local machine learning models (Whisper), it ensures that private meetings, interviews, and memos never leave the user's machine. 

## ✨ Key Features & Workflows

### 📝 Audio Transcript Workflows
Seamlessly import, play, and edit raw text alongside the source audio. The application maps text to precise millisecond timestamps, estimates confidence scores, and organizes dialogues.

### 🧠 AI Recipes
Go far beyond raw text. Users can apply customized, reusable prompts ("Recipes") to completed transcripts. This allows the system to automatically generate clean meeting minutes, extract definitive action items, format clinical notes, or summarize hours of dialogue instantly.

### ⚡ Batch Processing & Watch Folders
Built for heavy volume and automation. Users can drag-and-drop dozens of files into a processing queue. Furthermore, users can assign a "Watch Folder" on their desktop—any audio file saved to this folder is automatically detected, transcribed, processed by an AI recipe, and exported without a single click.

### 🎙️ Real-Time Recording
Capture microphone input or system audio directly within the application, generating live, streaming transcriptions for immediate use, dictation, or accessibility.

### 📁 Projects Features
Organize transcripts into distinct, logical workspaces. This allows users to keep specific client interviews, team meetings, or research topics neatly isolated and searchable.

---

## 🛠️ Technical Stack
The application is built on a modern, robust architecture that fuses native desktop capabilities with web-scale backend tools:

*   **Frontend (Desktop):** An Electron shell wrapping a React/TypeScript interface. It utilizes Tailwind CSS for styling and Framer Motion for highly responsive UI animations.
*   **Audio & AI Engine:** `@xenova/transformers` running local Whisper models, paired with `fluent-ffmpeg` and `ffmpeg-static` for foolproof, cross-platform audio decoding and resampling.
*   **Backend API:** Node.js powered by Fastify, providing high-performance REST endpoints, rate limiting, and WebSocket (`socket.io`) for real-time progress updates.
*   **Database & Auth:** Supabase (PostgreSQL) managed via Prisma ORM, utilizing Row-Level Security and Supabase Storage for secure media handling.

## 📜 Core Development Rules
1.  **Strict Privacy Default:** Local decoding and transcription must remain the default. Any cloud interaction must be completely opt-in.
2.  **Fluid UI Verification:** The interface must strictly reflect live backend database values; static mock data is restricted to initial prototyping.
3.  **Asynchronous Heavy Lifting:** Audio transcoding and AI model inference must run asynchronously or in background threads to ensure the main desktop UI never freezes or blocks.

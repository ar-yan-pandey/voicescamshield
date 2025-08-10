Voice Scam Shield
Real-time, browser-based call protection. Make P2P calls, transcribe speech live, highlight scam risk, and optionally let a local voice agent respond using on-device TTS. Includes a demo deepfake-alert popup.

Features

WebRTC video/audio calls (peer-to-peer) with Supabase Realtime for signaling
Live transcription with optional AI risk scoring
Local heuristic scam detection as a fallback/augment
Optional “Distractor Agent” for short, evasive replies:
Primary online LLM: Gemini 1.5 Flash (Edge Function)
Fallback local LLM in-browser via WebLLM (Llama-3.1-8B-Instruct-q4f32_1-MLC)
On-device TTS via Piper + onnxruntime-web (WASM SIMD)

Tech Stack

Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui (Radix UI)
Realtime/signaling: Supabase Realtime
Edge Functions (Deno): Supabase Functions
Online AI:
Transcription/risk: Google Gemini 2.0 Flash (gemini-transcribe function)
Agent replies: Google Gemini 1.5 Flash (agent-reply function)

On-device AI:


WebLLM runtime: @mlc-ai/web-llm
Model (fallback): Llama-3.1-8B-Instruct-q4f32_1-MLC
TTS: @mintplex-labs/piper-tts-web on onnxruntime-web (WASM SIMD)
Language detection: franc + langs
Heuristic scam detection: local rule-based scoring (no external model)
Project Structure (selected)
src/pages/CallRoom.tsx — main call UI, transcription, alerts, keyboard shortcuts
src/hooks/useWebRTCRoom.ts — WebRTC + Supabase signaling
src/utils/AudioChunker.ts — mic capture, VAD, WAV encoding (24kHz mono)
src/utils/scamDetection.ts — local heuristic risk scoring
src/hooks/useDistractorAgent.ts — agent replies (Gemini → fallback WebLLM) + Piper TTS
supabase/functions/gemini-transcribe — Gemini 2.0 Flash transcription (+ optional scam risk)
supabase/functions/agent-reply — Gemini 1.5 Flash short “stalling” replies
Setup

Prerequisites:

Node.js 18+ and npm
A Supabase project (optional if using the included hosted project); Supabase CLI if you want to deploy functions
A Google Generative AI key (GEMINI_API_KEY) for Edge Functions
Clone and install
npm i
Run the app
npm run dev
Open the printed local URL
Using the hosted Supabase (default)
The app is preconfigured to use an existing Supabase project for signaling and Edge Functions:
URL: https://qmgjplrejeslnqyoagvu.supabase.co
The client anon key is embedded for convenience in src/integrations/supabase/client.ts
The CallRoom posts audio chunks to:
https://qmgjplrejeslnqyoagvu.functions.supabase.co/functions/v1/gemini-transcribe
This works out of the box if that project is active and has GEMINI_API_KEY set. If you fork to your own Supabase, see “Bring your own Supabase”.

If you want to use your own Supabase project:

A) Update the client

Edit src/integrations/supabase/client.ts to point to your project URL and anon key.
B) Deploy Edge Functions

Install the Supabase CLI and log in
Set your GEMINI_API_KEY secret:
supabase secrets set GEMINI_API_KEY=your_google_genai_key
Deploy functions:
supabase functions deploy gemini-transcribe
supabase functions deploy agent-reply
C) Point the frontend to your functions

In src/pages/CallRoom.tsx, update the fetch URL used for transcription to your new functions endpoint:
https://YOUR-PROJECT-REF.functions.supabase.co/functions/v1/gemini-transcribe
Notes:

Both functions have CORS set to "*"
supabase/config.toml sets verify_jwt = false for these functions (public callable)
Environment and Keys
Client (Vite):

None required for default hosted setup; Supabase client URL/key are embedded in src/integrations/supabase/client.ts
If you want to hide keys and use your own project, refactor to use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
Supabase Edge Functions:

GEMINI_API_KEY: required for both gemini-transcribe and agent-reply
Optional local function serve:

supabase functions serve --env-file .env
.env should contain GEMINI_API_KEY=...
Development Scripts
npm run dev — start Vite dev server
npm run build — production build
npm run preview — preview production build
npm run lint — ESLint
Key Dependencies (high level)
Realtime/DB: @supabase/supabase-js
WebRTC: browser RTCPeerConnection (with Google & Twilio STUN servers)
On-device LLM: @mlc-ai/web-llm (Llama-3.1-8B-Instruct-q4f32_1-MLC fallback)
TTS: @mintplex-labs/piper-tts-web + onnxruntime-web (WASM SIMD)
Transcription (online): Google Gemini 2.0 Flash via Edge Function
Agent (online): Google Gemini 1.5 Flash via Edge Function
UI: React, shadcn/ui (Radix UI), Tailwind CSS
Language detection: franc, langs
Charts: recharts
Full dependency versions are in package.json; highlights:

react 18.3.x, vite 5.x, typescript 5.x
@supabase/supabase-js ^2.54.0
@mlc-ai/web-llm ^0.2.79
@mintplex-labs/piper-tts-web ^1.0.4
onnxruntime-web ^1.22.0
franc ^6.2.0, langs ^2.0.0
@radix-ui/*, shadcn/ui components

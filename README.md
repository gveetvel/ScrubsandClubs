# Scrubs & Clubs Studio

Scrubs & Clubs Studio is now a simplified AI-assisted short-form video production app for a golf content brand.

The app is built around:

`Idea -> Upload -> Analyze -> Generate -> Preview -> Download`

Instead of acting like a broad content-ops dashboard, the MVP now focuses on generating near-ready short drafts directly inside the app.

## What works now

- Title-first quick create flow
- Local video upload for MP4 and MOV files
- Project-based workflow
- OpenRouter service layer for text generation with fallback behavior
- Groq Whisper (free) for transcript extraction with fallback transcript simulation
- Gemini 1.5 Flash (free) for AI-powered video analysis and moment detection
- Visible fallback warnings when AI providers are unavailable
- Multi-segment stitched short plans
- Real ffmpeg-based MP4 preview rendering (async, non-blocking)
- Burned-in transcript subtitles
- Burned-in funny overlay captions in brand color
- Downloadable MP4, `.srt`, caption text, and CapCut brief
- Secondary publishing queue for approved drafts

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- JSON file-based persistence (no database required)
- ffmpeg-static for local rendering
- Google Drive integration (OAuth, optional)

## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy env vars

```bash
cp .env.example .env
```

3. Build and run

```bash
npm run build
npm run dev
```

Then open:

```text
http://127.0.0.1:3000
```

## Windows quick run

```powershell
cd /d "D:\GithubLocal\ScrubsandClubs"
Copy-Item .env.example .env -Force
npm.cmd install
npm.cmd run dev
```

## How to go from idea to exported video

### Step 1 — Set up your API keys (one-time)

Open `.env` and add your free API keys. All three are optional — the app works without them using fallbacks, but the output quality is much better with them.

| Key | What it does | Get it free at |
|---|---|---|
| `OPENROUTER_API_KEY` | Generates hooks, captions, hashtags | [openrouter.ai](https://openrouter.ai) |
| `GROQ_API_KEY` | Transcribes your video audio | [console.groq.com](https://console.groq.com) |
| `GEMINI_API_KEY` | AI watches your video to find the best moments | [aistudio.google.com](https://aistudio.google.com) |

### Step 2 — Start the app

```bash
npm run dev
```

Open `http://127.0.0.1:3000` in your browser.

### Step 3 — Create a new project

1. Go to the **Create** page at `/`
2. Type a title or idea for your short (e.g. "Doctor tries to chip from the bunker")
3. Upload one or more local videos (MP4 or MOV), or select existing uploads from your library

### Step 4 — Generate

Click **Generate short project**. The app now runs the full pipeline automatically:

1. 🧠 **Text package** — AI generates a concept angle, multiple hook options, captions, hashtags, CTA, and funny overlay ideas
2. 🎤 **Transcription** — Your video audio is sent to Groq Whisper, which returns timestamped transcript segments
3. 👁️ **Video analysis** — Your video is uploaded to Gemini 1.5 Flash, which watches the footage and identifies the 4-8 best moments (funniest reactions, strongest hooks, most satisfying payoffs)
4. ✂️ **Short plan** — The top moments are selected, ordered (hook first, payoff last), and capped at 6 seconds each
5. 🎬 **Render** — ffmpeg stitches the clips together with flash transitions, zoom punch-in on reactions, speed ramp on talking segments, burned-in subtitles, and branded overlay captions
6. 📦 **Export** — The finished MP4 plus `.srt` subtitles, caption text, and a CapCut brief are saved

> ⚠️ If any API key is missing, the app falls back to local templates/heuristics and shows a yellow warning banner on the project page.

### Step 5 — Review your short

1. Open the generated project page
2. Watch the **preview video** inline — it's a fully rendered 9:16 vertical short
3. Check the **detected moments** panel to see what the AI picked and why
4. Review the **subtitles** and **overlay captions** burned into the video
5. Check the **progress steps** to see if any fallbacks were used

### Step 6 — Download or export

- Click the **download** link to save the rendered MP4
- Download the `.srt` file for separate subtitle editing
- Download the **caption text** file (ready to paste into TikTok/Reels/Shorts)
- Download the **CapCut brief** JSON for finishing touches in a proper editor

### Step 7 — Iterate (optional)

- Click **Render all drafts** to render alternate cuts with different moment ordering
- Click **Make primary** on an alternate draft to switch which cut is featured
- Click **Regenerate preview** to re-render with any changes
- Use **Approve** → **Send to publishing** to queue approved shorts

## Storage model

### Local uploads

- Video files: `public/uploads`
- Upload metadata: `data/local-uploads.json`

### Projects and drafts

- Project state, short drafts, settings, publishing queue: `data/projects.json`

### Render outputs

- Rendered draft files: `public/rendered-exports`
- Render metadata mirror: `data/rendered-short-drafts.json`

## Environment variables

### Core local upload

```env
LOCAL_UPLOAD_MAX_MB=1024
NEXT_PUBLIC_LOCAL_UPLOAD_MAX_MB=1024
```

### OpenRouter text generation

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1/chat/completions
OPENROUTER_SITE_URL=http://127.0.0.1:3000
OPENROUTER_SITE_NAME=Scrubs & Clubs Studio
```

### Groq Whisper speech-to-text (FREE)

How to get your free API key:
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with Google or GitHub (completely free)
3. Navigate to **API Keys** and click **Create API Key**
4. Copy the key and paste it into your `.env` file

```env
GROQ_API_KEY=
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_TRANSCRIPTION_BASE_URL=https://api.groq.com/openai/v1
```

### Google Gemini video analysis (FREE)

How to get your free API key:
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API Key** in the left sidebar
4. Click **Create API key** and select any Google Cloud project (or create one)
5. Copy the key and paste it into your `.env` file

The free tier includes 15 requests per minute and 1 million tokens per minute — more than enough for local use.

```env
GEMINI_API_KEY=
```

### Optional future integrations

```env
CAPCUT_API_KEY=
CAPCUT_API_BASE_URL=
METRICOOL_API_KEY=
METRICOOL_API_BASE_URL=
```

### Google Drive integration (optional)

Google Drive allows importing source footage and exporting finished shorts. Requires OAuth setup.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/api/integrations/google-drive/callback
GOOGLE_DRIVE_SOURCE_FOLDER_NAME=Video's to edit
```

## Provider behavior

### OpenRouter

- Used for concept angle, hooks, captions, hashtags, CTA, funny caption ideas, and editing tone suggestions
- If unavailable, the app falls back to local text package generation and labels the project as fallback

### Groq Whisper (speech-to-text)

- Preferred path for transcript-driven subtitles and moment scoring
- Audio is compressed locally via ffmpeg before upload to reduce payload size
- Uses Groq's free `whisper-large-v3-turbo` model (extremely fast LPU-powered inference)
- If unavailable, the app falls back to simulated transcript segments so the workflow still completes

### Google Gemini (video analysis)

- Uploads source video to the Gemini File API for multimodal processing
- Gemini 1.5 Flash watches the video and reads the transcript simultaneously
- Returns exact timestamps of the funniest, most engaging, and most viral moments
- If unavailable, the app falls back to keyword-based heuristic moment detection

### Fallback visibility

- When any provider is unavailable, the project page shows a **yellow warning banner** at the top
- Each progress step that used a fallback is highlighted in amber with a specific explanation
- Source videos using simulated transcripts show an amber "⚠️ simulated transcript" badge

## Render behavior

- Rendering uses `ffmpeg-static`
- Drafts are rendered as 9:16 vertical MP4 files
- The current pipeline trims one or more segments, stitches them together, burns in subtitles, burns in funny overlay captions, and writes export assets
- Rendering is triggered separately from project generation (non-blocking)

### Render outputs

- MP4 draft preview
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON

### Current limits

- Uploads are standard multipart uploads, not chunked uploads
- Gemini video analysis requires the video to be uploaded to the Gemini File API (temporary, auto-deleted)
- Moment selection quality depends on whether Gemini is configured (AI) or not (keyword heuristic)

## Verified local flow

Verified in the current codebase:

- `npm run build` passes
- `/` serves the new Create page shell
- `/library`, `/projects/[id]`, `/shorts/[id]`, `/publishing`, and `/settings` return successfully
- `POST /api/projects/generate` creates a real project from a local uploaded video
- The generation route creates stitched short drafts
- Vision AI analyzes uploaded videos when Gemini is configured
- Fallback warnings appear when AI providers are missing
- The rendered MP4 is served successfully through `/api/renders/assets/[filename]`

## Product docs

- [MVP PRD](./docs/mvp-prd.md)
- [Architecture](./docs/architecture.md)

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
- Hosted STT adapter for transcript extraction with fallback transcript simulation
- Transcript-backed moment detection
- Multi-segment stitched short plans
- Real ffmpeg-based MP4 preview rendering
- Burned-in transcript subtitles
- Burned-in funny overlay captions in brand color
- Downloadable MP4, `.srt`, caption text, and CapCut brief
- Secondary publishing queue for approved drafts

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL schema
- ffmpeg-static for local rendering

## Local setup

1. Install dependencies

```bash
npm install
```

2. Copy env vars

```bash
cp .env.example .env
```

3. Generate Prisma client if you want the schema ready locally

```bash
npm run prisma:generate
```

4. Build and run

```bash
npm run build
npm run start
```

Then open:

```text
http://127.0.0.1:3000
```

## Windows quick run

```powershell
cd /d "C:\Users\gille\Desktop\PROJECTS\GOLF Channel"
Copy-Item .env.example .env -Force
npm.cmd install
npm.cmd run build
npm.cmd run start
```

## Main local workflow

1. Open the Create page at `/`
2. Enter a title or simple idea
3. Upload one or more local videos, or choose an existing uploaded video
4. Click `Generate short project`
5. Open the generated project page
6. Review the primary short draft
7. Play the preview, inspect subtitles and overlay captions
8. Download the MP4 or handoff package

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

### Hosted speech-to-text

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=whisper-1
OPENAI_TRANSCRIPTION_BASE_URL=https://api.openai.com/v1
```

### Optional future integrations

```env
CAPCUT_API_KEY=
CAPCUT_API_BASE_URL=
METRICOOL_API_KEY=
METRICOOL_API_BASE_URL=
```

### Optional future Google Drive path

Google Drive remains in the codebase but is no longer part of the main MVP workflow.

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

### Hosted STT

- Preferred path for transcript-driven subtitles and moment scoring
- Audio is compressed locally before upload to reduce payload size
- If unavailable, the app falls back to simulated transcript segments so the workflow still completes

## Render behavior

- Rendering uses `ffmpeg-static`
- Drafts are rendered as 9:16 vertical MP4 files
- The current pipeline trims one or more segments, stitches them together, burns in subtitles, burns in funny overlay captions, and writes export assets

### Render outputs

- MP4 draft preview
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON

### Current limits

- Local rendering is synchronous and meant for MVP development use
- Uploads are standard multipart uploads, not chunked uploads
- Hosted STT depends on configured credentials
- Moment selection is transcript-driven and heuristic rather than a full multimodal ranking model

## Verified local flow

Verified in the current codebase:

- `npm run build` passes
- `/` serves the new Create page shell
- `/library`, `/projects/[id]`, `/shorts/[id]`, `/publishing`, and `/settings` return successfully
- `POST /api/projects/generate` creates a real project from a local uploaded video
- The generation route creates stitched short drafts
- The primary draft auto-renders a downloadable MP4
- The rendered MP4 is served successfully through `/api/renders/assets/[filename]`

## Product docs

- [MVP PRD](./docs/mvp-prd.md)
- [Architecture](./docs/architecture.md)

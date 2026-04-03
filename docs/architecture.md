# Scrubs & Clubs Studio Architecture

## Technical approach

The app uses Next.js App Router, TypeScript, Tailwind CSS, and local JSON file-based persistence to power a local-first AI-assisted short-form video production workflow:

`Idea -> Upload -> Analyze -> Generate -> Preview -> Download`

All data is stored in JSON files — no database or ORM is required:

- source videos live in `public/uploads`
- rendered drafts and sidecar assets live in `public/rendered-exports`
- uploaded video metadata lives in `data/local-uploads.json`
- project, short draft, publishing queue, and settings metadata live in `data/projects.json`
- render output metadata is mirrored in `data/rendered-short-drafts.json`

## Layers

### Presentation layer

- `src/app/page.tsx` — quick-create entry point
- `src/app/projects/[id]/page.tsx` — main generation/review workflow
- `src/app/shorts/[id]/page.tsx` — detailed draft review and export surface
- `src/app/library/page.tsx` — uploads and projects browser
- `src/app/settings/page.tsx` — brand style and provider setup

### Domain layer

Core types are defined in `src/lib/types.ts`:

- `Project` — primary workflow entity
- `SourceVideo` — uploaded footage, transcript status, and project linkage
- `DetectedMoment` — scored moments (AI-detected via Gemini or keyword-based fallback)
- `ShortPlanSegment` — stitched segment selections across one or more source videos
- `EditedShort` — generated short draft record
- `OverlayCaptionCue` — funny brand-color caption timing separate from subtitles
- `BrandStyleSettings` — render and packaging defaults

**Status unions:** `TranscriptStatus`, `AnalysisStatus`, `RenderStatus`, `ProjectStatus`, and `ProgressStepStatus` are defined as union types in `types.ts` with no duplicate values.

### Shared utilities

`src/lib/format-utils.ts` provides shared helper functions used across the codebase:

- `formatTime(seconds)` — converts seconds to `MM:SS` strings
- `slugify(input)` — URL-safe slug generation
- `toSeconds(value)` — parses `MM:SS` or `HH:MM:SS` strings to seconds
- `sanitizeFilename(filename)` — strips unsafe characters from file names

These are imported by the short engine, mock engine, transcription service, renderer, vision AI, and upload repository. No duplicate implementations exist elsewhere.

### Service layer

- `src/lib/services/openrouter.ts`
  - OpenRouter text generation
  - concept angle, hooks, captions, hashtags, CTA, funny caption ideas, tone/style suggestions
  - falls back to local template generation when unavailable
  - fallback result is cached during OpenRouter response merging to avoid redundant computation
- `src/lib/services/transcription.ts`
  - Groq Whisper `whisper-large-v3-turbo` (free tier)
  - compressed audio extraction via ffmpeg
  - simulated fallback transcript generation when API key is missing
  - all transcript segments include numeric `startSeconds`/`endSeconds` for downstream use
- `src/lib/services/vision-ai.ts`
  - Gemini 2.5 Flash multimodal video analysis (free tier)
  - uploads video to the Gemini File API for processing
  - sends a structured prompt asking the AI to watch the video and identify the best moments
  - analyzes both visual content (swings, reactions, ball flight) and audio (commentary, reactions)
  - returns exact timestamps with scores, labels, and reasoning
  - falls back to keyword-based heuristic detection when unavailable
- `src/lib/services/integrations/google-drive.ts`
  - Google Drive OAuth integration
  - scopes: `drive.readonly` (import footage) and `drive.file` (export app-created assets)
  - folder browsing and video import
- `src/lib/short-engine.ts`
  - transcript summarization
  - fallback moment scoring (keyword heuristic, used when Gemini is unavailable)
  - stitched short plan construction
  - subtitle cue mapping
  - funny overlay caption cue generation
  - progress step builder (6 steps: text, transcribe, vision, moments, plan, render)
- `src/lib/mock-short-engine.ts`
  - simulated transcript generation with numeric timestamps
  - clip blueprint generation
  - automated short workflow simulation
- `src/lib/server/short-renderer.ts`
  - dead-air trimming on clip boundaries
  - per-segment effects (zoom punch-in for hooks/reactions, speed ramp for lessons)
  - xfade transitions (`fadewhite` for hook, `fadeblack` for body segments)
  - subtitle burn-in from SRT
  - funny overlay caption burn-in in brand color
  - hook title burn-in
  - thumbnail generation
  - MP4, `.srt`, caption text, and CapCut brief generation

### Persistence layer

- `src/lib/server/local-upload-repository.ts`
  - upload manifest
  - source video metadata
  - transcript/status updates
  - project linkage for uploaded videos
- `src/lib/server/project-repository.ts`
  - project records
  - short draft records
  - publishing queue
  - brand settings
- `src/lib/server/rendered-short-repository.ts`
  - persisted render output metadata for local previews/exports

## API surface

- `POST /api/uploads`
  - multipart local upload for MP4/MOV
- `GET /api/projects`
  - returns persisted project state, drafts, queue, and settings
- `POST /api/projects/generate`
  - creates a project from a title and selected uploaded videos
  - runs OpenRouter package generation
  - runs Groq Whisper transcription (or fallback)
  - uploads video to Gemini and runs vision-based moment detection (or keyword fallback)
  - scores moments and builds stitched short plans
  - returns immediately — rendering is triggered separately
- `PATCH /api/projects/[id]`
  - project updates such as switching the primary draft
- `PATCH /api/shorts/[id]`
  - short draft edits and status changes
- `POST /api/renders/short-drafts`
  - manual render by `shortId` (non-blocking for UI)
- `GET /api/settings` and `PATCH /api/settings`
  - brand/render defaults
- `GET /api/publishing`, `POST /api/publishing`, `DELETE /api/publishing`
  - secondary publishing queue persistence
- Google Drive OAuth endpoints:
  - `GET /api/integrations/google-drive/auth-url`
  - `GET /api/integrations/google-drive/callback`
  - `GET /api/integrations/google-drive/status`
  - `POST /api/integrations/google-drive/import`

## Generation pipeline

### Steps

1. **Text package generation** — OpenRouter generates hooks, captions, hashtags, CTA
2. **Audio transcription** — Groq Whisper extracts timestamped transcript segments
3. **Video analysis** — Gemini 2.5 Flash watches the video and identifies the best moments
4. **Moment selection** — Top 8 moments are sorted by confidence score
5. **Short plan construction** — Selected moments are stitched into a short plan
6. **Subtitle + overlay generation** — Transcript-derived subtitles and funny captions are mapped

### Fallback behavior

Each step has an independent fallback:
- **Text**: local template generation (labeled "fallback")
- **Transcription**: simulated transcript segments with numeric timestamps
- **Vision**: keyword-based heuristic moment scoring
- **UI**: amber warning banners and per-step fallback indicators

## Render pipeline

### Inputs

- one generated short draft
- one or more stitched `ShortPlanSegment` items
- transcript-derived subtitle cues
- funny overlay caption cues
- brand style settings

### Output

- preview MP4 draft (9:16 vertical)
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON
- clickbait thumbnail (JPEG)

### Implementation notes

- segments are trimmed directly from local uploaded source videos
- dead-air trimming shaves 0.2s from clip boundaries on clips longer than 4s
- segments are concatenated into one vertical 9:16 draft with xfade transitions
- hook/reaction segments get a subtle 1.08x zoom punch-in effect
- setup/lesson segments get a 1.18x speed ramp
- subtitles are burned in from transcript-derived SRT cues
- funny overlay captions are burned in separately in brand color
- hook title is burned in for the first 2.2 seconds
- rendering remains local-first and ffmpeg-based
- rendering is decoupled from project generation (non-blocking)

## AI provider summary

| Provider | Service | Cost | Fallback |
|---|---|---|---|
| OpenRouter | Text generation | Free models available | Local templates |
| Groq Whisper | Speech-to-text | Free tier | Simulated transcript |
| Gemini 2.5 Flash | Video analysis | Free tier | Keyword heuristic |

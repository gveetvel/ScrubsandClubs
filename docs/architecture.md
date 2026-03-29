# Scrubs & Clubs Studio Architecture

## Technical approach

The app keeps the existing Next.js App Router, TypeScript, Tailwind, local upload storage, and ffmpeg rendering foundation, but refactors the domain around a new top-level `Project` workflow:

`Idea -> Upload -> Analyze -> Generate -> Preview -> Download`

The current implementation remains local-first and practical:

- source videos live in `public/uploads`
- rendered drafts and sidecar assets live in `public/rendered-exports`
- uploaded video metadata lives in `data/local-uploads.json`
- project, short draft, publishing queue, and settings metadata live in `data/projects.json`
- render output metadata also remains mirrored in `data/rendered-short-drafts.json`

## Layers

### Presentation layer

- `src/app/page.tsx` is now the quick-create entry point
- `src/app/projects/[id]/page.tsx` is the main generation/review workflow
- `src/app/shorts/[id]/page.tsx` is the detailed draft review and export surface
- `src/app/library/page.tsx` keeps uploads and projects browsable
- `src/app/settings/page.tsx` holds brand style and provider setup

### Domain layer

- `Project` is now the primary workflow entity
- `SourceVideo` tracks uploaded footage, transcript status, and project linkage
- `DetectedMoment` stores scored moments (AI-detected via Gemini or keyword-based fallback)
- `ShortPlanSegment` stores stitched segment selections across one or more source videos
- `EditedShort` now acts as the generated short draft record
- `OverlayCaptionCue` stores funny brand-color caption timing separate from subtitles
- `BrandStyleSettings` stores render and packaging defaults

### Service layer

- `src/lib/services/openrouter.ts`
  - OpenRouter text generation
  - concept angle, hooks, captions, hashtags, CTA, funny caption ideas, tone/style suggestions
  - falls back to local template generation when unavailable
- `src/lib/services/transcription.ts`
  - Groq Whisper `whisper-large-v3-turbo` (free tier)
  - compressed audio extraction via ffmpeg
  - simulated fallback transcript generation when API key is missing
- `src/lib/services/vision-ai.ts`
  - Gemini 1.5 Flash multimodal video analysis (free tier)
  - uploads video to the Gemini File API for processing
  - sends a structured prompt asking the AI to watch the video and identify the best moments
  - analyzes both visual content (swings, reactions, ball flight) and audio (commentary, reactions)
  - returns exact timestamps with scores, labels, and reasoning
  - falls back to keyword-based heuristic detection when unavailable
- `src/lib/short-engine.ts`
  - transcript summarization
  - fallback moment scoring (keyword heuristic, used when Gemini is unavailable)
  - stitched short plan construction
  - subtitle cue mapping
  - funny overlay caption cue generation
  - progress step builder (including the new `step-vision` step)
- `src/lib/server/short-renderer.ts`
  - stitched segment trimming
  - multi-input concat
  - subtitle burn-in
  - funny overlay caption burn-in
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

## Generation pipeline

### Steps

1. **Text package generation** — OpenRouter generates hooks, captions, hashtags, CTA
2. **Audio transcription** — Groq Whisper extracts timestamped transcript segments
3. **Video analysis** — Gemini 1.5 Flash watches the video and identifies the best moments
4. **Moment selection** — Top 8 moments are sorted by confidence score
5. **Short plan construction** — Selected moments are stitched into a short plan
6. **Subtitle + overlay generation** — Transcript-derived subtitles and funny captions are mapped

### Fallback behavior

Each step has an independent fallback:
- **Text**: local template generation (labeled "fallback")
- **Transcription**: simulated transcript segments
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

- preview MP4 draft
- `.srt` subtitle file
- caption text file
- CapCut finishing brief JSON

### Implementation notes

- segments are trimmed directly from local uploaded source videos
- segments are concatenated into one vertical 9:16 draft
- subtitles are burned in from transcript-derived cues
- funny overlay captions are burned in separately in brand color
- rendering remains local-first and ffmpeg-based
- rendering is decoupled from project generation (non-blocking)

## AI provider summary

| Provider | Service | Cost | Fallback |
|---|---|---|---|
| OpenRouter | Text generation | Free models available | Local templates |
| Groq Whisper | Speech-to-text | Free tier | Simulated transcript |
| Gemini 1.5 Flash | Video analysis | Free tier | Keyword heuristic |

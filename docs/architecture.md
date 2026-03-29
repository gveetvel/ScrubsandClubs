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
- `DetectedMoment` stores scored transcript-backed moments
- `ShortPlanSegment` stores stitched segment selections across one or more source videos
- `EditedShort` now acts as the generated short draft record
- `OverlayCaptionCue` stores funny brand-color caption timing separate from subtitles
- `BrandStyleSettings` stores render and packaging defaults

### Service layer

- `src/lib/services/openrouter.ts`
  - OpenRouter text generation
  - concept angle, hooks, captions, hashtags, CTA, funny caption ideas, tone/style suggestions
- `src/lib/services/transcription.ts`
  - hosted STT adapter
  - compressed audio extraction via ffmpeg
  - simulated fallback transcript generation
- `src/lib/short-engine.ts`
  - transcript summarization
  - moment scoring
  - stitched short plan construction
  - subtitle cue mapping
  - funny overlay caption cue generation
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
  - runs hosted transcription or fallback
  - scores moments
  - builds stitched short plans
  - auto-renders the primary draft when possible
- `PATCH /api/projects/[id]`
  - project updates such as switching the primary draft
- `PATCH /api/shorts/[id]`
  - short draft edits and status changes
- `POST /api/renders/short-drafts`
  - manual re-render by `shortId`
- `GET /api/settings` and `PATCH /api/settings`
  - brand/render defaults
- `GET /api/publishing`, `POST /api/publishing`, `DELETE /api/publishing`
  - secondary publishing queue persistence

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

### Current implementation notes

- segments are trimmed directly from local uploaded source videos
- segments are concatenated into one vertical 9:16 draft
- subtitles are burned in from transcript-derived cues
- funny overlay captions are burned in separately in brand color
- rendering remains local-first and ffmpeg-based for MVP practicality

## Current limitations

- hosted STT depends on configured credentials
- OpenRouter depends on configured credentials
- fallback transcript/text generation remains active when providers are missing
- rendering is synchronous and local, not queued or distributed
- the current stitched short selector is heuristic and transcript-driven, not a full multimodal model yet

# Scrubs & Clubs Studio MVP PRD

## Product summary

Scrubs & Clubs Studio is now a simplified AI-assisted short-form video production app for a golf creator brand. The core experience starts with a title or quick idea, adds one or more local source videos, and generates a near-ready short draft with transcript-backed subtitles, funny overlay captions, in-app preview, and downloadable MP4 export.

## Problem

The old workflow behaved more like a planning tool than a production tool. It spread work across ideas, clips, calendar, and publishing states, but still left the creator to do the real heavy lifting elsewhere. The MVP now shifts the center of gravity into the app itself:

- generate the concept package
- analyze the uploaded footage
- find the strongest moments
- stitch those moments into a short
- render a real preview
- export a real draft

## Users

- Creator/admin
- Future editor or teammate who needs a clean handoff package

## Core jobs to be done

- Start from just a title or simple idea
- Upload local source footage directly into the app
- Generate hooks, captions, hashtags, CTA, and funny overlay ideas
- Transcribe audio into exact subtitle text when hosted STT is configured
- Detect the best moments from one or more uploaded videos
- Stitch those moments into a high-energy short draft
- Preview the draft in-app and download the MP4 plus support assets

## Primary workflow

### 1. Quick create

1. User enters a title or one-sentence idea.
2. User uploads one or more local MP4 or MOV files, or chooses recent uploaded source videos.
3. User clicks `Generate short project`.

### 2. Text package generation

1. The app uses OpenRouter for concept angle, hook options, caption options, hashtags, CTA options, funny caption ideas, subtitle tone, and editing vibe suggestions.
2. If OpenRouter is unavailable, the app falls back to local package generation and labels that state clearly.

### 3. Transcript and moment analysis

1. The app extracts compressed audio from uploaded videos.
2. It sends the audio to a hosted speech-to-text provider when configured.
3. It stores transcript segments and uses them to detect strong short-form moments.
4. If hosted STT is unavailable, the app falls back to simulated transcript data for MVP continuity.

### 4. Short construction

1. The app selects multiple strong moments from one or more uploaded videos.
2. It builds a stitched short plan with opening hook, reaction/setup, and payoff beats.
3. It generates transcript-derived subtitles and separate funny overlay caption cues.
4. It renders a vertical MP4 preview draft inside the app.

### 5. Review and export

1. User opens the project or short draft detail page.
2. User reviews preview, subtitles, overlay captions, caption package, CTA, hashtags, and render state.
3. User downloads the MP4 draft, subtitle file, caption text, and CapCut finishing brief.
4. User can optionally queue the approved draft for publishing handoff.

## V1 scope

- Create page with title-first quick-start flow
- Local upload flow for source footage
- Project page that owns analysis, moment review, generated drafts, and preview actions
- OpenRouter service layer for text generation tasks
- Hosted STT adapter with clear fallback to simulated transcript generation
- Multi-segment stitched short plans
- Real ffmpeg-based MP4 preview rendering
- Transcript-derived subtitle files
- Funny brand-color overlay captions
- Downloadable MP4, `.srt`, caption text, and CapCut brief
- Simpler library, settings, and secondary publishing queue

## Out of scope for V1

- Mandatory auth/team collaboration
- Direct CapCut account automation
- Direct Metricool posting dependency
- Google Drive dependency
- Production-scale background queueing or chunked cloud upload

## Success criteria

The MVP is successful if a creator can:

- enter only a title or simple idea
- upload one or more local videos
- automatically generate hooks, captions, hashtags, and CTA
- analyze the uploaded footage
- produce stitched short drafts from the best moments
- preview the resulting short inside the app
- download the MP4 draft and support assets
- optionally send approved drafts to a publishing queue

## Provider assumptions

- OpenRouter is used for language generation only
- Hosted STT is the preferred subtitle/transcript path
- Local upload remains the default ingestion workflow
- CapCut stays optional for final polish
- If providers are unavailable, the app falls back clearly rather than failing closed

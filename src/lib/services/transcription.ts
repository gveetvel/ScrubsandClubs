import { readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { SourceVideo, TranscriptSegment, TranscriptSource } from "@/lib/types";
import { runFfmpeg, tempDir } from "@/lib/server/ffmpeg";

interface TranscriptionResult {
  provider: string;
  source: TranscriptSource;
  warning?: string;
  transcriptSegments: TranscriptSegment[];
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function transcriptTemplates(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("surgeon")) {
    return [
      "We started this hole feeling confident and that should have been the warning sign.",
      "We knew the 5-wood was wrong and still talked ourselves into it.",
      "The diagnosis after that swing was somehow worse than the shot itself.",
      "If this putt misses, the whole break one hundred challenge changes."
    ];
  }

  if (normalized.includes("lesson") || normalized.includes("fix") || normalized.includes("swing")) {
    return [
      "This session started with the exact same miss we keep seeing.",
      "One cue changed the contact immediately and you could hear it.",
      "That is what makes this before and after worth turning into a short."
    ];
  }

  return [
    "This upload starts with a moment that tells you exactly what kind of round it is.",
    "The funniest part is that the reaction lands even before the payoff.",
    "That is why one long video can become several tight short drafts."
  ];
}

function fallbackTranscript(video: SourceVideo): TranscriptionResult {
  const lines = transcriptTemplates(video.title);
  const transcriptSegments = lines.map((text, index) => {
    const startSeconds = 8 + index * 6;
    const endSeconds = startSeconds + 5;
    return {
      id: `${video.id}-fallback-transcript-${index + 1}`,
      start: formatTime(startSeconds),
      end: formatTime(endSeconds),
      startSeconds,
      endSeconds,
      source: "simulated" as const,
      text
    };
  });

  return {
    provider: "fallback",
    source: "simulated",
    warning: "Hosted transcription unavailable. Using simulated transcript fallback.",
    transcriptSegments
  };
}

async function extractCompressedAudio(sourceAbsolutePath: string) {
  const audioPath = path.join(tempDir(), `transcription-${randomUUID().slice(0, 10)}.mp3`);
  await runFfmpeg([
    "-y",
    "-i",
    sourceAbsolutePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    "32k",
    audioPath
  ]);
  return audioPath;
}

export async function transcribeSourceVideo(video: SourceVideo): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo";

  if (!apiKey || !video.storagePath) {
    return fallbackTranscript(video);
  }

  const sourceAbsolutePath = path.join(process.cwd(), "public", video.storagePath.replace(/^\//, ""));

  try {
    const audioPath = await extractCompressedAudio(sourceAbsolutePath);
    const audioBuffer = await readFile(audioPath);
    const formData = new FormData();
    formData.append("model", model);
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");
    formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), path.basename(audioPath));

    const baseUrl = process.env.GROQ_TRANSCRIPTION_BASE_URL ?? "https://api.groq.com/openai/v1";
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });

    await unlink(audioPath).catch(() => undefined);

    if (!response.ok) {
      throw new Error(`Transcription provider returned ${response.status}`);
    }

    const data = (await response.json()) as {
      segments?: Array<{ id?: number; start?: number; end?: number; text?: string }>;
      text?: string;
    };

    const transcriptSegments =
      data.segments?.map((segment, index) => ({
        id: `${video.id}-transcript-${segment.id ?? index + 1}`,
        start: formatTime(segment.start ?? 0),
        end: formatTime(segment.end ?? 0),
        startSeconds: segment.start ?? 0,
        endSeconds: segment.end ?? 0,
        source: "hosted" as const,
        text: segment.text?.trim() ?? ""
      })).filter((segment) => segment.text.length > 0) ?? [];

    if (transcriptSegments.length === 0 && data.text) {
      return {
        provider: "openai",
        source: "hosted",
        transcriptSegments: [
          {
            id: `${video.id}-transcript-1`,
            start: "00:00",
            end: video.duration,
            startSeconds: 0,
            endSeconds: undefined,
            source: "hosted",
            text: data.text.trim()
          }
        ]
      };
    }

    if (transcriptSegments.length === 0) {
      throw new Error("No transcript segments returned.");
    }

    return {
      provider: "groq",
      source: "hosted",
      transcriptSegments
    };
  } catch {
    return fallbackTranscript(video);
  }
}

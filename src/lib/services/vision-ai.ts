import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { DetectedMoment } from "@/lib/types";
import { formatTime } from "@/lib/format-utils";

interface GeminiFileUploadResponse {
    file: {
        uri: string;
        name: string;
        state: string;
        mimeType: string;
    };
}

interface GeminiGenerateResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
}

interface VisionMomentRaw {
    label?: string;
    reason?: string;
    startSeconds?: number;
    endSeconds?: number;
    score?: number;
    energy?: "high" | "medium";
    tags?: string[];
    transcriptExcerpt?: string;
    editHint?: "speed_ramp" | "zoom_punch" | "hard_cut" | "flash_transition" | "slow_reveal";
    suggestedDurationSeconds?: number;
}

function buildVisionPrompt(projectTitle: string, transcript: string): string {
    return `You are an expert short-form golf video editor for the brand "Scrubs & Clubs".
Your job is to watch the provided video and find the absolute best moments to cut into a viral 30-60 second vertical short.

You must analyze BOTH the visual content (swings, reactions, facial expressions, ball flight, scenery) AND the audio/dialogue (funny commentary, genuine reactions, instructional tips, dramatic pauses).

## Context
Title/idea: ${projectTitle}
Transcript: ${transcript}

## Your task
Identify exactly 4-8 standout moments from this video. For each moment, provide:
1. "label" — A punchy 5-8 word title for this moment
2. "reason" — Why this moment works for short-form (hook value, comedy, relatability, visual impact)
3. "startSeconds" — Exact start timestamp in seconds
4. "endSeconds" — Exact end timestamp in seconds (each moment should be 2-6 seconds MAX)
5. "score" — Confidence score 0-100 of how viral/engaging this moment is
6. "energy" — "high" or "medium"
7. "tags" — Array of 1-3 tags from: ["hook", "setup", "reaction", "payoff", "lesson", "comedy", "visual"]
8. "transcriptExcerpt" — The dialogue that occurs during this moment
9. "editHint" — One of: "zoom_punch" (for reactions/hooks), "speed_ramp" (for setup/talking), "hard_cut" (for action moments), "flash_transition" (for dramatic reveals), "slow_reveal" (for payoffs)
10. "suggestedDurationSeconds" — How long this clip should be in the final edit (2-6 seconds)

## Rules
- The FIRST moment must work as an opening hook (something that grabs attention in <2 seconds)
- At least one moment must be a genuine reaction or funny beat
- At least one moment should be a payoff or satisfying conclusion
- Moments should come from DIFFERENT parts of the video — spread them out
- Prefer moments where audio energy and visual action align
- Keep clips TIGHT: 2-4 seconds for reactions/hooks, 4-6 seconds max for everything else
- If someone says something genuinely funny, that beats a generic "nice shot"
- Use "zoom_punch" editHint for reactions and hooks, "speed_ramp" for talking/setup moments
- Return ONLY a valid JSON array. No markdown fences. No explanation outside the array.`;
}

async function getFileMimeType(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
    };
    return mimeMap[ext] ?? "video/mp4";
}

async function uploadVideoToGemini(
    filePath: string,
    apiKey: string
): Promise<{ uri: string; mimeType: string; fileName: string }> {
    // Verify file exists and get size in a single stat call
    let fileSize: number;
    try {
        fileSize = (await stat(filePath)).size;
    } catch {
        throw new Error(`Video file not found at: ${filePath}`);
    }

    const mimeType = await getFileMimeType(filePath);
    const displayName = path.basename(filePath);

    console.log(`[vision-ai] Starting upload for: ${displayName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    // Step 1: Start resumable upload
    const startResponse = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "X-Goog-Upload-Protocol": "resumable",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Header-Content-Length": String(fileSize),
                "X-Goog-Upload-Header-Content-Type": mimeType,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                file: { display_name: displayName },
            }),
        }
    );

    if (!startResponse.ok) {
        const errorBody = await startResponse.text().catch(() => "(unreadable)");
        throw new Error(
            `Gemini file upload start failed: ${startResponse.status} — ${errorBody}`
        );
    }

    const uploadUrl = startResponse.headers.get("X-Goog-Upload-URL");
    if (!uploadUrl) {
        throw new Error("Gemini did not return an upload URL.");
    }

    // Step 2: Upload the file bytes
    const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Length": String(fileSize),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
        },
        body: Readable.toWeb(createReadStream(filePath)) as ReadableStream,
    });

    if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.text().catch(() => "(unreadable)");
        throw new Error(
            `Gemini file upload failed: ${uploadResponse.status} — ${errorBody}`
        );
    }

    const uploadResult = (await uploadResponse.json()) as GeminiFileUploadResponse;
    const fileUri = uploadResult.file?.uri;
    if (!fileUri) {
        console.error("[vision-ai] Upload successful but no URI returned in response body.");
        throw new Error("Gemini file upload returned no URI.");
    }
    console.log(`[vision-ai] Upload successful. URI: ${fileUri}`);

    // Step 3: Wait for file to become ACTIVE (Gemini processes the video)
    const fileName = uploadResult.file.name;
    console.log(`[vision-ai] Watching video for processing status (name: ${fileName})...`);
    for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        if (attempt > 0 && attempt % 10 === 0) {
            console.log(`[vision-ai] Waiting for Gemini to process video (attempt ${attempt}/60)...`);
        }

        const statusResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
        );

        if (statusResponse.ok) {
            const statusData = (await statusResponse.json()) as { state?: string; uri?: string };
            if (statusData.state === "ACTIVE") {
                console.log(`[vision-ai] Video state: ACTIVE (Attempt ${attempt + 1})`);
                return { uri: statusData.uri ?? fileUri, mimeType, fileName };
            }
            if (statusData.state === "FAILED") {
                console.error(`[vision-ai] Video state: FAILED. Check if format is supported.`);
                throw new Error("Gemini video processing failed.");
            }
            
            if (attempt % 5 === 0) {
                console.log(`[vision-ai] Video state: ${statusData.state || "PROCESSING"}... (Attempt ${attempt + 1}/60)`);
            }
        }
    }

    throw new Error("Gemini video processing timed out after 300 seconds.");
}

function extractJsonArray(text: string): VisionMomentRaw[] {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
        throw new Error("No JSON array found in Gemini response.");
    }

    return JSON.parse(text.slice(start, end + 1)) as VisionMomentRaw[];
}

export interface VisionDetectionResult {
    provider: "gemini" | "fallback";
    moments: DetectedMoment[];
    warning?: string;
}

export async function detectMomentsWithVision(
    projectId: string,
    sourceVideoId: string,
    sourceVideoPath: string,
    projectTitle: string,
    transcript: string
): Promise<VisionDetectionResult> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            provider: "fallback",
            moments: [],
            warning:
                "Gemini API key not configured. Set GEMINI_API_KEY in .env to enable AI video analysis.",
        };
    }

    const absolutePath = path.join(
        process.cwd(),
        "public",
        sourceVideoPath.replace(/^\//, "")
    );

    try {
        console.log(`[vision-ai] Starting analysis for video: ${sourceVideoId}`);
        const { uri: fileUri, mimeType, fileName } = await uploadVideoToGemini(absolutePath, apiKey);

        const prompt = buildVisionPrompt(projectTitle, transcript);
        console.log(`[vision-ai] Sending multimodal request to Gemini 2.5 Flash...`);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        file_data: {
                                            mime_type: mimeType,
                                            file_uri: fileUri,
                                        },
                                    },
                                    { text: prompt },
                                ],
                            },
                        ],
                        generationConfig: {
                            temperature: 0.4,
                            maxOutputTokens: 4096,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[vision-ai] Generation failed (${response.status}):`, errorText);

                if (response.status === 429) {
                    throw new Error("Gemini API rate limit exceeded. Please wait a minute before trying again.");
                }
                if (response.status === 403) {
                    throw new Error("Gemini API key has no quota or is invalid. Check billing/usage.");
                }
                throw new Error(`Gemini analysis request failed: ${response.statusText}`);
            }

            const data = (await response.json()) as GeminiGenerateResponse;
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!content) {
                console.error(`[vision-ai] Empty response from model. Full response:`, JSON.stringify(data));
                throw new Error("Gemini model returned an empty response.");
            }

            console.log(`[vision-ai] Received response (${content.length} chars). Parsing JSON...`);

            let rawMoments: VisionMomentRaw[];
            try {
                rawMoments = extractJsonArray(content);
            } catch (parseError) {
                console.error("[vision-ai] Failed to parse Gemini response. Raw content:", content.slice(0, 500));
                throw parseError;
            }

            const moments: DetectedMoment[] = rawMoments
                .filter(
                    (m) =>
                        typeof m.startSeconds === "number" &&
                        typeof m.endSeconds === "number" &&
                        m.label
                )
                .map((m, index) => ({
                    id: `${sourceVideoId}-vision-moment-${index + 1}`,
                    projectId,
                    sourceVideoId,
                    label: m.label ?? `Moment ${index + 1}`,
                    reason: m.reason ?? "AI-detected moment with strong short-form potential.",
                    transcriptExcerpt: m.transcriptExcerpt ?? "",
                    tags: m.tags ?? ["hook"],
                    score: Math.min(100, Math.max(0, m.score ?? 75)),
                    start: formatTime(m.startSeconds ?? 0),
                    end: formatTime(m.endSeconds ?? 0),
                    startSeconds: m.startSeconds ?? 0,
                    endSeconds: m.endSeconds ?? 0,
                    energy: m.energy ?? "medium",
                    editHint: m.editHint,
                }));

            console.log(`[vision-ai] Analysis complete. Detected ${moments.length} valid moments.`);
            return {
                provider: "gemini",
                moments: moments.sort((a, b) => b.score - a.score).slice(0, 8),
            };
        } finally {
            // Best-effort cleanup: delete the uploaded file from Gemini Files storage
            await fetch(
                `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
                { method: "DELETE" }
            ).catch(() => {});
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[vision-ai] detectMomentsWithVision failed for video %s: %s", sourceVideoId, message);
        return {
            provider: "fallback",
            moments: [],
            warning: message,
        };
    }
}

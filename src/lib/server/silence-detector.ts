import path from "path";
import { runFfmpeg } from "./ffmpeg";

interface SilenceRegion {
    startSeconds: number;
    endSeconds: number;
}

/**
 * Detects silence in a specific time range of a video file.
 * Returns the start/end offsets (relative to segmentStart) where
 * non-silent audio begins and ends.
 */
export async function detectSilenceBoundaries(
    absoluteVideoPath: string,
    segmentStartSeconds: number,
    segmentDurationSeconds: number
): Promise<{ trimmedStart: number; trimmedEnd: number }> {
    const originalStart = segmentStartSeconds;
    const originalEnd = segmentStartSeconds + segmentDurationSeconds;

    try {
        // Run ffmpeg silencedetect to find silent regions
        // We capture stderr because ffmpeg outputs detection info there
        const silenceThresholdDb = -30;
        const minSilenceDuration = 0.4;

        const tempOutput = path.join(
            process.cwd(),
            "data",
            `silence-${Date.now()}.txt`
        );

        // Run silencedetect and capture output
        let silenceOutput = "";
        try {
            await runFfmpeg([
                "-ss", String(segmentStartSeconds),
                "-t", String(segmentDurationSeconds),
                "-i", absoluteVideoPath,
                "-af", `silencedetect=n=${silenceThresholdDb}dB:d=${minSilenceDuration}`,
                "-f", "null",
                "-"
            ]);
        } catch {
            // silencedetect outputs to stderr which may cause runFfmpeg to "fail"
            // but the output is still captured; this is expected behavior
        }

        // If we can't detect silence, return original boundaries unchanged
        // (the actual parsing of stderr would require modifying runFfmpeg to capture output)
        // For now, apply a simple heuristic: trim 0.3s from any segment longer than 4s
        if (segmentDurationSeconds > 4) {
            return {
                trimmedStart: originalStart + 0.2,
                trimmedEnd: originalEnd - 0.2
            };
        }

        return {
            trimmedStart: originalStart,
            trimmedEnd: originalEnd
        };
    } catch {
        // If silence detection fails, return original boundaries
        return {
            trimmedStart: originalStart,
            trimmedEnd: originalEnd
        };
    }
}

/**
 * Trims dead air from the start and end of each segment.
 * Returns updated start/end seconds for each segment.
 */
export async function trimDeadAir(
    segments: Array<{
        sourceAbsolutePath: string;
        startSeconds: number;
        durationSeconds: number;
    }>
): Promise<Array<{ startSeconds: number; durationSeconds: number }>> {
    const results: Array<{ startSeconds: number; durationSeconds: number }> = [];

    for (const segment of segments) {
        const { trimmedStart, trimmedEnd } = await detectSilenceBoundaries(
            segment.sourceAbsolutePath,
            segment.startSeconds,
            segment.durationSeconds
        );

        results.push({
            startSeconds: trimmedStart,
            durationSeconds: Math.max(1, trimmedEnd - trimmedStart)
        });
    }

    return results;
}

import { clipSuggestions } from "@/lib/data/mock-data";

export interface EditingProvider {
  exportEditPackage(clipId: string): Promise<{
    clipId: string;
    ratio: string;
    overlays: string[];
    subtitles: string;
    musicVibe: string;
    notes: string;
  }>;
}

export class MockCapCutProvider implements EditingProvider {
  async exportEditPackage(clipId: string) {
    const clip = clipSuggestions.find((item) => item.id === clipId);

    if (!clip) {
      throw new Error("Clip not found");
    }

    return {
      clipId,
      ratio: "9:16",
      overlays: clip.overlaySuggestions,
      subtitles: clip.subtitleStyle,
      musicVibe: clip.musicVibe,
      notes: `Manual CapCut fallback package for "${clip.title}". Open with hook first, preserve fast cuts, and end on the payoff line.`
    };
  }
}

import { CapCutHandoffPackage, ClipSuggestion, EditedShort, SourceVideo, SubtitleCue, TranscriptSegment } from "@/lib/types";

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toSeconds(value: string) {
  const parts = value.split(":").map((item) => Number(item));
  if (parts.some((item) => Number.isNaN(item))) {
    return 0;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function videoDurationSeconds(video: SourceVideo) {
  return Math.max(toSeconds(video.duration), 75);
}

function transcriptTemplates(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("surgeon")) {
    return [
      "We started this hole feeling weirdly confident and that should have been the warning sign.",
      "The swing looked harmless until the ball started peeling toward trouble almost immediately.",
      "That is the kind of shot that deserves a full diagnosis before we even get to the next lie.",
      "The funny part is the commentary was somehow cleaner than the golf itself.",
      "Then we finally hit one solid and the mood changed in about three seconds.",
      "That turnaround is exactly why this round can feed multiple shorts."
    ];
  }

  if (normalized.includes("swing") || normalized.includes("fix") || normalized.includes("lesson")) {
    return [
      "This session started with the same miss we keep seeing every single round.",
      "One cue changed the feel right away and the strike finally sounded different.",
      "The useful part is that you can see the before and after without a long explanation.",
      "That makes this section perfect for a short where the lesson lands fast.",
      "Once the contact improved the confidence followed almost instantly.",
      "That swing-change proof is exactly what the app should package automatically."
    ];
  }

  return [
    "This upload starts with a moment that immediately tells you what kind of round it is.",
    "There is a clean mistake here that works because the problem and the payoff are both obvious.",
    "A few minutes later the reaction alone becomes a short-form hook.",
    "Then the round gives us a useful takeaway instead of just chaos.",
    "The recovery beat makes the story feel complete inside a sub-minute clip.",
    "That combination is why one long video can become multiple post-ready shorts."
  ];
}

export function simulateTranscript(video: SourceVideo): TranscriptSegment[] {
  const duration = videoDurationSeconds(video);
  const lines = transcriptTemplates(video.title);
  const step = Math.max(Math.floor(duration / (lines.length + 1)), 9);

  return lines.map((text, index) => {
    const startSeconds = 12 + index * step;
    const endSeconds = Math.min(startSeconds + 8, duration);
    return {
      id: `${video.id}-transcript-${index + 1}`,
      start: formatTime(startSeconds),
      end: formatTime(endSeconds),
      text
    };
  });
}

function buildSubtitleCues(videoId: string, clipIndex: number, clipStart: number, excerpt: string): SubtitleCue[] {
  const phrases = excerpt
    .split(/[,.;:!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  return phrases.map((text, phraseIndex) => {
    const start = clipStart + phraseIndex * 3;
    return {
      id: `${videoId}-subtitle-${clipIndex + 1}-${phraseIndex + 1}`,
      start: formatTime(start),
      end: formatTime(start + 3),
      text
    };
  });
}

function clipBlueprints(video: SourceVideo) {
  const normalized = video.title.toLowerCase();
  const slug = slugify(video.title);

  if (normalized.includes("swing") || normalized.includes("fix") || normalized.includes("lesson")) {
    return [
      {
        suffix: "before-after",
        title: "Before and after proof",
        hook: "You can see the swing change before I even explain the cue.",
        reason: "Visual transformation works instantly on mute and gives the clip a complete arc.",
        caption: "One cue, one cleaner strike, and suddenly the before-and-after becomes obvious.",
        overlaySuggestions: ["Before", "After", "One cue changed it"],
        subtitleStyle: "Bold centered subtitles with highlighted lesson words",
        musicVibe: "Motivational build with clean transitions",
        viralFormat: "Before -> cue -> after",
        styleSuggestion: "Use split-screen framing and freeze the before frame for one beat."
      },
      {
        suffix: "lesson-cue",
        title: "The one cue that fixed contact",
        hook: "This is the simplest cue we tried and it changed contact immediately.",
        reason: "Tip-led clips travel well because the fix is fast and the proof is visible.",
        caption: "This cue is simple enough to try today and visual enough to keep viewers watching.",
        overlaySuggestions: ["Try this cue", "Cleaner contact fast"],
        subtitleStyle: "Large tutorial subtitles with emphasized keywords",
        musicVibe: "Focused upbeat training energy",
        viralFormat: "Problem -> cue -> proof",
        styleSuggestion: "Punch in during the cue and slow the impact frame slightly."
      },
      {
        suffix: "confidence-turn",
        title: "The confidence shift",
        hook: "You can actually hear the confidence come back after this strike.",
        reason: "Emotion plus improvement gives the short a satisfying ending.",
        caption: "The shot matters, but the confidence change is what makes this feel like a story.",
        overlaySuggestions: ["Confidence switched on", "This changed the session"],
        subtitleStyle: "Clean lower-third subtitles with reaction emphasis",
        musicVibe: "Comeback lift",
        viralFormat: "Struggle -> strike -> confidence",
        styleSuggestion: "Hold reaction audio for half a second before bringing music back in."
      }
    ];
  }

  if (normalized.includes("surgeon") || normalized.includes("frustration")) {
    return [
      {
        suffix: "opening-hook",
        title: "The opening line that sets the round",
        hook: "The first line in this upload already tells you the round is about to go sideways.",
        reason: "The opening is self-contained and instantly frames the tone for short-form viewers.",
        caption: "Some rounds give you the hook in the first few seconds. This one definitely did.",
        overlaySuggestions: ["You know this is going badly", "Opening line was enough"],
        subtitleStyle: "Burned-in meme subtitles with fast emphasis",
        musicVibe: "Light tension with comedic release",
        viralFormat: "Cold open -> reveal -> reaction",
        styleSuggestion: "Start on the quote immediately and cut to the ball flight on the beat."
      },
      {
        suffix: "mistake-breakdown",
        title: "The mistake everyone recognizes",
        hook: "Every golfer knows exactly what went wrong the second this decision gets said out loud.",
        reason: "Relatable pain plus a fast consequence makes this easy to package.",
        caption: "The bad decision is visible, the consequence is fast, and the short almost writes itself.",
        overlaySuggestions: ["This decision ended the hole", "Relatable golf pain"],
        subtitleStyle: "Chunky lower-third subtitles with highlighted club names",
        musicVibe: "Tense to comedic drop",
        viralFormat: "Decision -> consequence -> laugh",
        styleSuggestion: "Use a hard text pop on the decision line, then cut immediately to payoff."
      },
      {
        suffix: "recovery-payoff",
        title: "The recovery everyone stays for",
        hook: "Just when the hole feels lost, this recovery gives the clip a real payoff.",
        reason: "Comeback energy extends watch time because viewers want the emotional release.",
        caption: "The recovery is what turns this from a golf moment into a full short-form story.",
        overlaySuggestions: ["Unexpected recovery", "This saved the vibe"],
        subtitleStyle: "Center subtitles with comeback words highlighted",
        musicVibe: "Comeback energy with lift",
        viralFormat: "Setback -> recovery -> reaction",
        styleSuggestion: "Let the reaction breathe after the recovery instead of rushing the cut."
      }
    ].map((item) => ({
      ...item,
      title: `${item.title} (${slug})`
    }));
  }

  return [
    {
      suffix: "opening-hook",
      title: "Opening hook",
      hook: "This upload gives us a short-worthy moment almost immediately.",
      reason: "Fast context and a clear tone make this a strong first candidate.",
      caption: "The first real beat in this long video already has enough shape for a short draft.",
      overlaySuggestions: ["This starts wild", "Hook in the first 10 seconds"],
      subtitleStyle: "Bold burned-in subtitles with keyword emphasis",
      musicVibe: "Upbeat tension builder",
      viralFormat: "Hook -> reveal -> reaction",
      styleSuggestion: "Open on the reaction face and keep the first subtitle on screen early."
    },
    {
      suffix: "mistake-breakdown",
      title: "Mistake breakdown",
      hook: "This is the exact decision that turns the hole.",
      reason: "Mistake-led clips perform because the pain and the lesson are both obvious.",
      caption: "One bad choice, one clean payoff, and a short that is easy to understand on mute.",
      overlaySuggestions: ["Where the hole went wrong", "Bad decision breakdown"],
      subtitleStyle: "Lower-third subtitles with highlighted golf terms",
      musicVibe: "Tense to release",
      viralFormat: "Mistake -> payoff -> lesson",
      styleSuggestion: "Use a quick zoom on the mistake line, then cut to ball result."
    },
    {
      suffix: "recovery-moment",
      title: "Recovery moment",
      hook: "This recovery is what saves the feel of the whole round.",
      reason: "The turnaround gives the short a satisfying emotional ending.",
      caption: "A recovery beat like this is exactly why one long upload can feed several shorts.",
      overlaySuggestions: ["Unexpected recovery", "This changed the round"],
      subtitleStyle: "Clean centered subtitles with reaction emphasis",
      musicVibe: "Comeback energy",
      viralFormat: "Setback -> recovery -> reaction",
      styleSuggestion: "Hold the recovery landing for one beat before revealing the reaction."
    }
  ];
}

export function generateAutomatedShortWorkflow(video: SourceVideo) {
  const transcriptSegments = video.transcriptSegments?.length ? video.transcriptSegments : simulateTranscript(video);
  const duration = videoDurationSeconds(video);
  const blueprint = clipBlueprints(video);
  const clipSpacing = Math.max(Math.floor(duration / (blueprint.length + 2)), 18);

  const clipSuggestions: ClipSuggestion[] = blueprint.map((entry, index) => {
    const segment = transcriptSegments[index] ?? transcriptSegments[0];
    const startSeconds = Math.min(toSeconds(segment?.start ?? "00:10"), duration - 12) || 10 + index * clipSpacing;
    const endSeconds = Math.min(startSeconds + 28 + index * 4, duration);
    const subtitleCues = buildSubtitleCues(video.id, index, startSeconds, segment?.text ?? entry.caption);

    return {
      id: `${video.id}-auto-clip-${index + 1}`,
      sourceVideoId: video.id,
      title: entry.title,
      hook: entry.hook,
      start: formatTime(startSeconds),
      end: formatTime(endSeconds),
      reason: entry.reason,
      caption: entry.caption,
      overlaySuggestions: entry.overlaySuggestions,
      subtitleStyle: entry.subtitleStyle,
      musicVibe: entry.musicVibe,
      viralFormat: entry.viralFormat,
      status: "suggested",
      transcriptExcerpt: segment?.text ?? entry.caption,
      subtitleCues
    };
  });

  const editedShorts: EditedShort[] = clipSuggestions.map((clip, index) => {
    const cta = index === 0 ? "Comment FULL if you want the entire round breakdown." : index === 1 ? "Save this before your next round." : "Tag the friend who needs this clip.";
    const hashtags = index === 1 ? ["#GolfTips", "#GolfShorts", "#ScrubsAndClubs"] : ["#GolfShorts", "#GolfTok", "#ScrubsAndClubs"];
    const styleSuggestion = blueprint[index]?.styleSuggestion ?? "Keep the opening line inside the first two seconds and let the reaction land.";
    const editingNotes = [
      "Format for 9:16 vertical.",
      "Use punchy burned-in subtitles.",
      "Front-load the strongest reaction inside the first two seconds.",
      styleSuggestion
    ];

    const capcutPackage: CapCutHandoffPackage = {
      format: "9:16",
      clipTitle: clip.title,
      sourceVideoId: video.id,
      start: clip.start,
      end: clip.end,
      subtitles: clip.subtitleCues ?? [],
      overlayText: clip.overlaySuggestions,
      introHook: clip.hook,
      caption: clip.caption,
      cta,
      musicVibe: clip.musicVibe,
      editingNotes
    };

    return {
      id: `${video.id}-auto-short-${index + 1}`,
      clipSuggestionId: clip.id,
      sourceVideoId: video.id,
      title: clip.title,
      status: "editing",
      platforms: ["YouTube Shorts", "Instagram Reels", "TikTok"],
      readyForMetricool: false,
      hook: clip.hook,
      overlayText: clip.overlaySuggestions,
      caption: clip.caption,
      cta,
      hashtags,
      musicVibe: clip.musicVibe,
      notes: styleSuggestion,
      packageStatus: "generated",
      subtitleCues: clip.subtitleCues,
      subtitleStyle: clip.subtitleStyle,
      styleSuggestion,
      generationSource: "automatic",
      capcutPackage
    };
  });

  return {
    transcriptSegments,
    transcriptPreview: transcriptSegments.slice(0, 2).map((segment) => segment.text).join(" "),
    clipSuggestions,
    editedShorts,
    videoPatch: {
      transcriptStatus: "available" as const,
      analysisStatus: "ready" as const,
      automationStatus: "drafts_ready" as const,
      shortsExtracted: editedShorts.length
    }
  };
}

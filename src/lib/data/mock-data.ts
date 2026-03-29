import {
  AppState,
  BrandStyleSettings,
  CalendarEntry,
  ClipSuggestion,
  ContentIdea,
  DashboardMetric,
  DetectedMoment,
  EditedShort,
  IntegrationConnection,
  MediaAsset,
  Project,
  PublishingItem,
  ShortPlanSegment,
  SourceVideo
} from "@/lib/types";

export const defaultBrandSettings: BrandStyleSettings = {
  overlayCaptionColor: "#B8FF65",
  subtitlePreset: "Bold punchy lower thirds",
  hookStylePreset: "Cold open reaction",
  tonePreset: "Funny but useful golf creator",
  platformPreset: "YouTube Shorts"
};

export const dashboardMetrics: DashboardMetric[] = [
  { label: "Projects generating", value: "1", detail: "One active project is already building stitched short drafts" },
  { label: "Drafts with preview", value: "2", detail: "Rendered previews are ready for creator review and download" },
  { label: "Uploaded source videos", value: "5", detail: "Local uploads and seeded examples are available in the library" },
  { label: "Publishing-ready shorts", value: "1", detail: "Approved drafts can still flow into the queue when needed" }
];

export const mediaAssets: MediaAsset[] = [
  {
    id: "asset-1",
    filename: "2-surgeons-try-to-break-100-episode-4.mp4",
    duration: "25:42",
    uploadDate: "2026-03-25",
    tags: ["long-form", "surgeons", "challenge"],
    sourceFolder: "Seeded library",
    project: "Road to Handicap 36"
  },
  {
    id: "asset-2",
    filename: "funniest-golf-frustration-moments.mp4",
    duration: "18:09",
    uploadDate: "2026-03-21",
    tags: ["funny", "reaction", "course"],
    sourceFolder: "Seeded library",
    project: "On-course comedy"
  },
  {
    id: "asset-3",
    filename: "before-after-swing-fix-session.mp4",
    duration: "11:16",
    uploadDate: "2026-03-20",
    tags: ["lesson", "progress", "before-after"],
    sourceFolder: "Seeded library",
    project: "Road to Handicap 36"
  }
];

export const sourceVideos: SourceVideo[] = [
  {
    id: "video-1",
    title: "2 surgeons try to break 100",
    description: "Challenge round with multiple strong reactions, decision mistakes, and a score-saving recovery.",
    duration: "25:42",
    transcriptStatus: "available",
    analysisStatus: "ready",
    assetId: "asset-1",
    ideaIds: ["idea-1"],
    shortsExtracted: 2,
    projectId: "project-1",
    transcriptSource: "simulated",
    transcriptionProvider: "fallback",
    transcriptPreview: "We started this hole feeling confident and that should have been the warning sign.",
    transcriptSegments: [
      {
        id: "video-1-transcript-1",
        start: "00:18",
        end: "00:25",
        startSeconds: 18,
        endSeconds: 25,
        source: "simulated",
        text: "We started this hole feeling confident and that should have been the warning sign."
      },
      {
        id: "video-1-transcript-2",
        start: "06:31",
        end: "06:39",
        startSeconds: 391,
        endSeconds: 399,
        source: "simulated",
        text: "We knew the 5-wood was wrong and still talked ourselves into it."
      },
      {
        id: "video-1-transcript-3",
        start: "14:19",
        end: "14:27",
        startSeconds: 859,
        endSeconds: 867,
        source: "simulated",
        text: "If this putt misses, the whole break one hundred challenge changes."
      }
    ]
  },
  {
    id: "video-2",
    title: "Funniest golf frustration moments",
    description: "Reaction-heavy golf comedy with surgeon-style commentary and relatable frustration.",
    duration: "18:09",
    transcriptStatus: "available",
    analysisStatus: "ready",
    assetId: "asset-2",
    ideaIds: ["idea-1"],
    shortsExtracted: 2,
    projectId: "project-1",
    transcriptSource: "simulated",
    transcriptionProvider: "fallback",
    transcriptPreview: "The diagnosis after that swing was somehow worse than the shot itself.",
    transcriptSegments: [
      {
        id: "video-2-transcript-1",
        start: "03:09",
        end: "03:17",
        startSeconds: 189,
        endSeconds: 197,
        source: "simulated",
        text: "The diagnosis after that swing was somehow worse than the shot itself."
      },
      {
        id: "video-2-transcript-2",
        start: "09:41",
        end: "09:49",
        startSeconds: 581,
        endSeconds: 589,
        source: "simulated",
        text: "Every golfer has muttered something like this after chunking one."
      }
    ]
  },
  {
    id: "video-3",
    title: "Before and after swing fix session",
    description: "Practice session showing one lesson that changes contact, shape, and confidence.",
    duration: "11:16",
    transcriptStatus: "available",
    analysisStatus: "ready",
    assetId: "asset-3",
    ideaIds: ["idea-2"],
    shortsExtracted: 1,
    transcriptSource: "simulated",
    transcriptionProvider: "fallback",
    transcriptPreview: "One cue changed the contact immediately.",
    transcriptSegments: [
      {
        id: "video-3-transcript-1",
        start: "01:42",
        end: "01:49",
        startSeconds: 102,
        endSeconds: 109,
        source: "simulated",
        text: "One cue changed the contact immediately and you could hear the strike change."
      }
    ]
  }
];

const primaryMoments: DetectedMoment[] = [
  {
    id: "moment-1",
    projectId: "project-1",
    sourceVideoId: "video-1",
    label: "Wrong-club confession",
    reason: "Immediate mistake language creates the hook and the payoff lands fast.",
    transcriptExcerpt: "We knew the 5-wood was wrong and still talked ourselves into it.",
    tags: ["hook", "mistake", "relatable"],
    score: 96,
    start: "06:31",
    end: "06:39",
    startSeconds: 391,
    endSeconds: 399,
    energy: "high"
  },
  {
    id: "moment-2",
    projectId: "project-1",
    sourceVideoId: "video-2",
    label: "Surgical diagnosis punchline",
    reason: "The brand angle is funny, distinct, and works as a second-beat punchline.",
    transcriptExcerpt: "The diagnosis after that swing was somehow worse than the shot itself.",
    tags: ["brand", "funny", "reaction"],
    score: 91,
    start: "03:09",
    end: "03:17",
    startSeconds: 189,
    endSeconds: 197,
    energy: "high"
  },
  {
    id: "moment-3",
    projectId: "project-1",
    sourceVideoId: "video-1",
    label: "Pressure putt setup",
    reason: "The consequence is immediately understandable, so retention stays high.",
    transcriptExcerpt: "If this putt misses, the whole break one hundred challenge changes.",
    tags: ["tension", "challenge", "payoff"],
    score: 88,
    start: "14:19",
    end: "14:27",
    startSeconds: 859,
    endSeconds: 867,
    energy: "medium"
  },
  {
    id: "moment-4",
    projectId: "project-1",
    sourceVideoId: "video-2",
    label: "Frustration mutter",
    reason: "Relatable golf pain makes a strong alternate ending beat.",
    transcriptExcerpt: "Every golfer has muttered something like this after chunking one.",
    tags: ["relatable", "comedy"],
    score: 84,
    start: "09:41",
    end: "09:49",
    startSeconds: 581,
    endSeconds: 589,
    energy: "medium"
  }
];

const primaryPlanSegments: ShortPlanSegment[] = [
  {
    id: "segment-1",
    sourceVideoId: "video-1",
    start: "06:31",
    end: "06:39",
    startSeconds: 391,
    endSeconds: 399,
    purpose: "hook",
    momentId: "moment-1"
  },
  {
    id: "segment-2",
    sourceVideoId: "video-2",
    start: "03:09",
    end: "03:17",
    startSeconds: 189,
    endSeconds: 197,
    purpose: "reaction",
    momentId: "moment-2"
  },
  {
    id: "segment-3",
    sourceVideoId: "video-1",
    start: "14:19",
    end: "14:27",
    startSeconds: 859,
    endSeconds: 867,
    purpose: "payoff",
    momentId: "moment-3"
  }
];

const alternatePlanSegments: ShortPlanSegment[] = [
  {
    id: "segment-4",
    sourceVideoId: "video-2",
    start: "03:09",
    end: "03:17",
    startSeconds: 189,
    endSeconds: 197,
    purpose: "hook",
    momentId: "moment-2"
  },
  {
    id: "segment-5",
    sourceVideoId: "video-1",
    start: "06:31",
    end: "06:39",
    startSeconds: 391,
    endSeconds: 399,
    purpose: "setup",
    momentId: "moment-1"
  },
  {
    id: "segment-6",
    sourceVideoId: "video-2",
    start: "09:41",
    end: "09:49",
    startSeconds: 581,
    endSeconds: 589,
    purpose: "payoff",
    momentId: "moment-4"
  }
];

export const projects: Project[] = [
  {
    id: "project-1",
    title: "2 surgeons try to break 100",
    ideaInput: "2 surgeons try to break 100",
    createdAt: "2026-03-28T10:30:00.000Z",
    updatedAt: "2026-03-28T10:42:00.000Z",
    status: "ready",
    sourceVideoIds: ["video-1", "video-2"],
    primaryShortId: "short-project-1-primary",
    shortDraftIds: ["short-project-1-primary", "short-project-1-alt"],
    summary: "One idea turned into a multi-video stitched short with a cold open, punchline, and tension payoff.",
    textPackage: {
      conceptAngle: "Use the surgeon-golfer identity to frame relatable bad decisions as a funny challenge story.",
      hookOptions: [
        "We knew this was the wrong club and still talked ourselves into it.",
        "The diagnosis after this swing was somehow worse than the shot.",
        "If this misses, the whole break-100 round changes."
      ],
      captionOptions: [
        "Golf confidence right before disaster is always elite.",
        "The swing diagnosis hurt more than the actual shot.",
        "This is exactly how a fun round turns into a challenge."
      ],
      hashtagOptions: ["#GolfShorts", "#GolfTok", "#ScrubsAndClubs", "#GolfHumor", "#Break100"],
      ctaOptions: ["Comment FULL if you want the whole round.", "Tag the friend who diagnoses every bad swing."],
      funnyCaptionIdeas: ["Worst 5-wood idea ever", "Doctor says it's bad", "Break 100 still alive"],
      subtitleToneSuggestion: "Fast, bold, center-safe subtitles with emphasized golf words",
      editingVibeSuggestion: "Cold open reaction, quick cuts, then a tension beat before the payoff",
      provider: "fallback",
      warning: "Seeded sample package generated from local fallback logic."
    },
    detectedMoments: primaryMoments,
    progressSteps: [
      { id: "step-text", label: "Generating text package", status: "complete" },
      { id: "step-transcribe", label: "Transcribing videos", status: "fallback" },
      { id: "step-moments", label: "Finding best moments", status: "complete" },
      { id: "step-plan", label: "Building short plan", status: "complete" },
      { id: "step-render", label: "Rendering preview", status: "pending" }
    ],
    warning: "This seeded project uses simulated transcripts until real hosted STT is configured."
  }
];

export const editedShorts: EditedShort[] = [
  {
    id: "short-project-1-primary",
    clipSuggestionId: "clip-1",
    sourceVideoId: "video-1",
    sourceVideoIds: ["video-1", "video-2"],
    projectId: "project-1",
    primary: true,
    draftStatus: "generated",
    title: "Wrong club, surgical diagnosis, pressure putt",
    status: "editing",
    platforms: ["YouTube Shorts", "Instagram Reels", "TikTok"],
    readyForMetricool: false,
    hook: "We knew this was the wrong club and still talked ourselves into it.",
    overlayText: ["Worst 5-wood idea ever", "Doctor says it's bad", "Break 100 still alive"],
    caption: "Golf confidence before disaster is always elite, especially when the diagnosis is funnier than the shot.",
    cta: "Comment FULL if you want the whole round breakdown.",
    hashtags: ["#GolfShorts", "#GolfTok", "#ScrubsAndClubs", "#GolfHumor"],
    musicVibe: "Fast comedic tension into a pressure payoff",
    notes: "Open instantly on the confession, punch into the diagnosis line, then let the putting tension breathe for one beat.",
    packageStatus: "generated",
    subtitleStyle: "Bold punchy lower thirds",
    styleSuggestion: "Keep the first subtitle inside the opening second and use one brand-color caption per beat.",
    generationSource: "automatic",
    renderStatus: "not_started",
    exportStatus: "not_ready",
    shortPlanSegments: primaryPlanSegments,
    subtitleCues: [
      {
        id: "subtitle-1",
        start: "00:00",
        end: "00:04",
        startSeconds: 0,
        endSeconds: 4,
        text: "We knew the 5-wood was wrong and still talked ourselves into it."
      },
      {
        id: "subtitle-2",
        start: "00:04",
        end: "00:08",
        startSeconds: 4,
        endSeconds: 8,
        text: "The diagnosis after that swing was somehow worse than the shot itself."
      },
      {
        id: "subtitle-3",
        start: "00:08",
        end: "00:12",
        startSeconds: 8,
        endSeconds: 12,
        text: "If this putt misses, the whole break one hundred challenge changes."
      }
    ],
    overlayCaptions: [
      {
        id: "overlay-1",
        start: "00:00",
        end: "00:02",
        startSeconds: 0,
        endSeconds: 2,
        text: "Worst 5-wood idea ever",
        color: "#B8FF65",
        style: "funny"
      },
      {
        id: "overlay-2",
        start: "00:04",
        end: "00:06",
        startSeconds: 4,
        endSeconds: 6,
        text: "Doctor says it's bad",
        color: "#B8FF65",
        style: "punchline"
      },
      {
        id: "overlay-3",
        start: "00:08",
        end: "00:10",
        startSeconds: 8,
        endSeconds: 10,
        text: "Break 100 still alive",
        color: "#B8FF65",
        style: "callout"
      }
    ],
    capcutPackage: {
      format: "9:16",
      clipTitle: "Wrong club, surgical diagnosis, pressure putt",
      sourceVideoId: "video-1",
      start: "00:00",
      end: "00:12",
      subtitles: [
        {
          id: "subtitle-1",
          start: "00:00",
          end: "00:04",
          text: "We knew the 5-wood was wrong and still talked ourselves into it."
        }
      ],
      overlayText: ["Worst 5-wood idea ever", "Doctor says it's bad", "Break 100 still alive"],
      introHook: "We knew this was the wrong club and still talked ourselves into it.",
      caption: "Golf confidence before disaster is always elite, especially when the diagnosis is funnier than the shot.",
      cta: "Comment FULL if you want the whole round breakdown.",
      musicVibe: "Fast comedic tension into a pressure payoff",
      editingNotes: [
        "Use a cold open on the confession line.",
        "Hit the diagnosis with the brand color caption.",
        "Leave half a beat of silence before the putt lands."
      ]
    }
  },
  {
    id: "short-project-1-alt",
    clipSuggestionId: "clip-2",
    sourceVideoId: "video-2",
    sourceVideoIds: ["video-1", "video-2"],
    projectId: "project-1",
    primary: false,
    draftStatus: "generated",
    title: "Diagnosis first, disaster second",
    status: "editing",
    platforms: ["YouTube Shorts", "Instagram Reels", "TikTok"],
    readyForMetricool: false,
    hook: "The diagnosis after this swing was somehow worse than the shot.",
    overlayText: ["Doctor says it's bad", "Worst club choice ever", "Every golfer says this"],
    caption: "The brand-angle version leads with the joke, then backs it up with the bad decision and relatable mutter.",
    cta: "Tag the friend who diagnoses every swing.",
    hashtags: ["#GolfHumor", "#GolfReels", "#ScrubsAndClubs"],
    musicVibe: "Comedic bounce with a sharp cold open",
    notes: "Lead with the punchline for faster retention on Reels and TikTok.",
    packageStatus: "generated",
    subtitleStyle: "Bold punchy lower thirds",
    styleSuggestion: "Prioritize the funniest line first, then compress the setup.",
    generationSource: "automatic",
    renderStatus: "not_started",
    exportStatus: "not_ready",
    shortPlanSegments: alternatePlanSegments,
    subtitleCues: [
      {
        id: "subtitle-4",
        start: "00:00",
        end: "00:04",
        startSeconds: 0,
        endSeconds: 4,
        text: "The diagnosis after that swing was somehow worse than the shot itself."
      },
      {
        id: "subtitle-5",
        start: "00:04",
        end: "00:08",
        startSeconds: 4,
        endSeconds: 8,
        text: "We knew the 5-wood was wrong and still talked ourselves into it."
      },
      {
        id: "subtitle-6",
        start: "00:08",
        end: "00:12",
        startSeconds: 8,
        endSeconds: 12,
        text: "Every golfer has muttered something like this after chunking one."
      }
    ],
    overlayCaptions: [
      {
        id: "overlay-4",
        start: "00:00",
        end: "00:02",
        startSeconds: 0,
        endSeconds: 2,
        text: "Doctor says it's bad",
        color: "#B8FF65",
        style: "punchline"
      }
    ]
  }
];

export const publishingQueue: PublishingItem[] = [
  {
    id: "pub-1",
    shortId: "short-project-1-primary",
    projectId: "project-1",
    shortTitle: "Wrong club, surgical diagnosis, pressure putt",
    platform: "YouTube Shorts",
    scheduledDate: "2026-03-31 19:30",
    hook: "We knew this was the wrong club and still talked ourselves into it.",
    caption: "Golf confidence before disaster is always elite.",
    cta: "Comment FULL if you want the whole round.",
    hashtags: ["#GolfShorts", "#GolfTok", "#ScrubsAndClubs"],
    overlayText: ["Worst 5-wood idea ever", "Doctor says it's bad"],
    musicVibe: "Fast comedic tension into a pressure payoff",
    readyForMetricool: true
  }
];

export const integrations: IntegrationConnection[] = [
  {
    id: "int-openrouter",
    name: "OpenRouter",
    status: "needs setup",
    summary: "Used for concept angles, hook options, captions, hashtags, CTA, and funny caption ideas.",
    nextStep: "Add OPENROUTER_API_KEY to unlock live text generation."
  },
  {
    id: "int-stt",
    name: "Hosted transcription",
    status: "needs setup",
    summary: "Used for exact transcript-driven subtitles and moment selection.",
    nextStep: "Add OPENAI_API_KEY to enable hosted speech-to-text with fallback extraction."
  },
  {
    id: "int-capcut",
    name: "CapCut handoff",
    status: "export mode",
    summary: "Rendered MP4 drafts, subtitle files, and briefs are ready for polishing in CapCut.",
    nextStep: "Use the handoff package for final polish. No direct API dependency is required."
  },
  {
    id: "int-metricool",
    name: "Metricool",
    status: "export mode",
    summary: "Approved drafts can still move into a publishing queue for handoff later.",
    nextStep: "Add API credentials later if direct sync becomes useful."
  }
];

export const contentIdeas: ContentIdea[] = [
  {
    id: "idea-1",
    title: "2 surgeons try to break 100",
    hook: "We knew this was the wrong club and still talked ourselves into it.",
    concept: "A brand-forward challenge short built from the funniest and most painful moments.",
    category: "surgeons playing golf",
    targetPlatforms: ["YouTube Shorts", "Instagram Reels", "TikTok"],
    viralityAngle: "Relatable golf pain plus a distinct brand angle",
    cta: "Comment FULL if you want the whole round breakdown.",
    overlayText: "Worst 5-wood idea ever",
    thumbnailText: "Doctor says it's bad",
    status: "editing",
    campaign: "Project-generated",
    sourceVideoId: "video-1"
  },
  {
    id: "idea-2",
    title: "Before and after swing fix",
    hook: "One cue changed the contact immediately.",
    concept: "Fast before-and-after improvement clip with a clear teaching payoff.",
    category: "transformation/progress",
    targetPlatforms: ["YouTube Shorts", "Instagram Reels"],
    viralityAngle: "Visible improvement that works even on mute",
    cta: "Comment SWING if you want the full drill.",
    overlayText: "One cue changed it",
    thumbnailText: "Before vs after",
    status: "raw footage available",
    campaign: "Project-generated",
    sourceVideoId: "video-3"
  }
];

export const clipSuggestions: ClipSuggestion[] = primaryMoments.map((moment, index) => ({
  id: `clip-${index + 1}`,
  sourceVideoId: moment.sourceVideoId,
  title: moment.label,
  hook: moment.transcriptExcerpt,
  start: moment.start,
  end: moment.end,
  reason: moment.reason,
  caption: projects[0].textPackage.captionOptions[index % projects[0].textPackage.captionOptions.length] ?? projects[0].textPackage.captionOptions[0],
  overlaySuggestions: projects[0].textPackage.funnyCaptionIdeas.slice(0, 2),
  subtitleStyle: defaultBrandSettings.subtitlePreset,
  musicVibe: projects[0].textPackage.editingVibeSuggestion,
  viralFormat: "Hook -> punchline -> payoff",
  status: index === 0 ? "accepted" : "suggested",
  transcriptExcerpt: moment.transcriptExcerpt,
  subtitleCues: editedShorts[0].subtitleCues?.slice(index, index + 1)
}));

export const calendarEntries: CalendarEntry[] = [
  {
    id: "cal-1",
    title: "Wrong club, surgical diagnosis, pressure putt",
    date: "2026-03-31 19:30",
    dayLabel: "Tue",
    platform: "YouTube Shorts",
    status: "scheduled",
    campaign: "Project-generated",
    linkedIdeaId: "idea-1",
    linkedShortId: "short-project-1-primary"
  }
];

export const weeklyStatusLanes = [
  { label: "Generating", count: 1 },
  { label: "Reviewing", count: 2 },
  { label: "Approved", count: 1 }
];

export const initialAppState: AppState = {
  brandSettings: defaultBrandSettings,
  projects,
  mediaAssets,
  sourceVideos,
  editedShorts,
  publishingQueue,
  integrations,
  ideas: contentIdeas,
  clipSuggestions,
  calendarEntries
};

export const initialMockState = initialAppState;

export type Platform = "YouTube Shorts" | "Instagram Reels" | "TikTok";
export type SourceType = "local_upload" | "google_drive" | "future_external";
export type UploadStatus = "uploaded" | "processing" | "failed";
export type TranscriptStatus = "not_started" | "transcribing" | "available" | "fallback" | "failed";
export type AnalysisStatus = "not_started" | "analyzing" | "ready" | "fallback" | "failed";
export type RenderStatus = "not_started" | "rendering" | "ready" | "failed";
export type GenerationSource = "openrouter" | "fallback";
export type TranscriptSource = "hosted" | "simulated";

export type WorkflowStatus =
  | "idea"
  | "raw footage available"
  | "clip selected"
  | "editing"
  | "ready to post"
  | "scheduled"
  | "posted";

export type IdeaCategory =
  | "funny"
  | "educational"
  | "challenge"
  | "relatable"
  | "fail/win moment"
  | "transformation/progress"
  | "golf tip"
  | "surgeons playing golf";

export type ProjectStatus = "draft" | "generating" | "ready" | "fallback" | "failed";
export type ProgressStepStatus = "pending" | "active" | "complete" | "fallback" | "failed";
export type SegmentPurpose = "hook" | "setup" | "lesson" | "reaction" | "payoff" | "montage" | "cta";
export type OverlayCaptionStyle = "funny" | "label" | "punchline" | "callout";
export type DraftStatus = "generated" | "approved" | "rejected" | "queued";

export interface ContentIdea {
  id: string;
  title: string;
  hook: string;
  concept: string;
  category: IdeaCategory;
  targetPlatforms: Platform[];
  viralityAngle: string;
  cta: string;
  overlayText: string;
  thumbnailText: string;
  status: WorkflowStatus;
  campaign: string;
  sourceVideoId?: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  duration: string;
  uploadDate: string;
  tags: string[];
  sourceFolder: string;
  project: string;
  sourceType?: SourceType;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
  uploadStatus?: UploadStatus;
  linkedIdeaId?: string;
  projectId?: string;
}

export interface TranscriptSegment {
  id: string;
  start: string;
  end: string;
  text: string;
  startSeconds?: number;
  endSeconds?: number;
  source?: TranscriptSource;
}

export interface SubtitleCue {
  id: string;
  start: string;
  end: string;
  text: string;
  startSeconds?: number;
  endSeconds?: number;
}

export interface OverlayCaptionCue {
  id: string;
  start: string;
  end: string;
  text: string;
  color: string;
  style: OverlayCaptionStyle;
  startSeconds: number;
  endSeconds: number;
}

export interface DetectedMoment {
  id: string;
  projectId: string;
  sourceVideoId: string;
  label: string;
  reason: string;
  transcriptExcerpt: string;
  tags: string[];
  score: number;
  start: string;
  end: string;
  startSeconds: number;
  endSeconds: number;
  energy: "high" | "medium";
}

export interface ShortPlanSegment {
  id: string;
  sourceVideoId: string;
  start: string;
  end: string;
  startSeconds: number;
  endSeconds: number;
  purpose: SegmentPurpose;
  momentId?: string;
}

export interface TextGenerationPackage {
  conceptAngle: string;
  hookOptions: string[];
  captionOptions: string[];
  hashtagOptions: string[];
  ctaOptions: string[];
  funnyCaptionIdeas: string[];
  subtitleToneSuggestion: string;
  editingVibeSuggestion: string;
  provider: GenerationSource;
  model?: string;
  warning?: string;
}

export interface BrandStyleSettings {
  overlayCaptionColor: string;
  subtitlePreset: string;
  hookStylePreset: string;
  tonePreset: string;
  platformPreset: Platform;
}

export interface ProjectProgressStep {
  id: string;
  label: string;
  status: ProgressStepStatus;
}

export interface SourceVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  transcriptStatus: TranscriptStatus | "available" | "pending" | "not available";
  analysisStatus: AnalysisStatus | "ready" | "queued" | "needs transcript";
  assetId: string;
  ideaIds: string[];
  shortsExtracted: number;
  sourceType?: SourceType;
  mimeType?: string;
  sizeBytes?: number;
  storagePath?: string;
  uploadStatus?: UploadStatus;
  linkedIdeaId?: string;
  transcriptSegments?: TranscriptSegment[];
  automationStatus?: "not_started" | "processing" | "drafts_ready";
  transcriptPreview?: string;
  projectId?: string;
  transcriptSource?: TranscriptSource;
  transcriptionProvider?: string;
  analysisProvider?: string;
  transcriptWarning?: string;
}

export interface ClipSuggestion {
  id: string;
  sourceVideoId: string;
  title: string;
  hook: string;
  start: string;
  end: string;
  reason: string;
  caption: string;
  overlaySuggestions: string[];
  subtitleStyle: string;
  musicVibe: string;
  viralFormat: string;
  status: "suggested" | "accepted" | "rejected";
  transcriptExcerpt?: string;
  subtitleCues?: SubtitleCue[];
}

export interface CapCutHandoffPackage {
  format: "9:16";
  clipTitle: string;
  sourceVideoId: string;
  start: string;
  end: string;
  subtitles: SubtitleCue[];
  overlayText: string[];
  introHook: string;
  caption: string;
  cta: string;
  musicVibe: string;
  editingNotes: string[];
}

export interface EditedShort {
  id: string;
  clipSuggestionId: string;
  sourceVideoId: string;
  title: string;
  status: WorkflowStatus;
  platforms: Platform[];
  readyForMetricool: boolean;
  hook: string;
  overlayText: string[];
  caption: string;
  cta: string;
  hashtags: string[];
  musicVibe: string;
  notes: string;
  packageStatus: "generated" | "customized" | "queued";
  subtitleCues?: SubtitleCue[];
  subtitleStyle?: string;
  styleSuggestion?: string;
  generationSource?: "automatic" | "manual";
  capcutPackage?: CapCutHandoffPackage;
  renderStatus?: RenderStatus;
  exportStatus?: "not_ready" | "download_ready";
  previewUrl?: string;
  renderedFilePath?: string;
  subtitleFilePath?: string;
  captionFilePath?: string;
  briefFilePath?: string;
  renderError?: string;
  projectId?: string;
  primary?: boolean;
  draftStatus?: DraftStatus;
  shortPlanSegments?: ShortPlanSegment[];
  overlayCaptions?: OverlayCaptionCue[];
  sourceVideoIds?: string[];
}

export interface Project {
  id: string;
  title: string;
  ideaInput: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  sourceVideoIds: string[];
  primaryShortId?: string;
  shortDraftIds: string[];
  textPackage: TextGenerationPackage;
  detectedMoments: DetectedMoment[];
  progressSteps: ProjectProgressStep[];
  summary: string;
  warning?: string;
}

export interface CalendarEntry {
  id: string;
  title: string;
  date: string;
  dayLabel: string;
  platform: Platform;
  status: WorkflowStatus;
  campaign: string;
  linkedIdeaId?: string;
  linkedShortId?: string;
}

export interface IntegrationConnection {
  id: string;
  name: string;
  status: "connected" | "export mode" | "needs setup";
  summary: string;
  nextStep: string;
}

export interface PublishingItem {
  id: string;
  shortId: string;
  shortTitle: string;
  platform: Platform;
  scheduledDate: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  overlayText: string[];
  musicVibe: string;
  readyForMetricool: boolean;
  capcutReady?: boolean;
  projectId?: string;
  previewUrl?: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  detail: string;
}

export interface AppState {
  brandSettings: BrandStyleSettings;
  projects: Project[];
  mediaAssets: MediaAsset[];
  sourceVideos: SourceVideo[];
  editedShorts: EditedShort[];
  publishingQueue: PublishingItem[];
  integrations: IntegrationConnection[];
  ideas: ContentIdea[];
  clipSuggestions: ClipSuggestion[];
  calendarEntries: CalendarEntry[];
}

export interface MockAppState extends AppState { }

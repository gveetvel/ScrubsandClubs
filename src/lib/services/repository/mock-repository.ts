import {
  calendarEntries,
  clipSuggestions,
  contentIdeas,
  dashboardMetrics,
  editedShorts,
  integrations,
  mediaAssets,
  publishingQueue,
  sourceVideos,
  weeklyStatusLanes
} from "@/lib/data/mock-data";

export const mockRepository = {
  getDashboard() {
    return {
      metrics: dashboardMetrics,
      weeklyStatusLanes,
      upcoming: calendarEntries,
      reusableSources: sourceVideos
    };
  },
  getIdeas() {
    return contentIdeas;
  },
  getMediaAssets() {
    return mediaAssets;
  },
  getSourceVideos() {
    return sourceVideos;
  },
  getSourceVideoById(id: string) {
    const video = sourceVideos.find((item) => item.id === id);
    if (!video) {
      return null;
    }

    return {
      ...video,
      asset: mediaAssets.find((asset) => asset.id === video.assetId) ?? null,
      ideas: contentIdeas.filter((idea) => video.ideaIds.includes(idea.id)),
      clips: clipSuggestions.filter((clip) => clip.sourceVideoId === id)
    };
  },
  getClipSuggestions() {
    return clipSuggestions;
  },
  getEditedShorts() {
    return editedShorts;
  },
  getPublishingQueue() {
    return publishingQueue;
  },
  getCalendar() {
    return calendarEntries;
  },
  getIntegrations() {
    return integrations;
  }
};

import { publishingQueue } from "@/lib/data/mock-data";

export interface PublishingProvider {
  exportQueue(): Promise<{
    createdAt: string;
    items: typeof publishingQueue;
    format: "json";
  }>;
}

export class MockMetricoolProvider implements PublishingProvider {
  async exportQueue() {
    return {
      createdAt: new Date().toISOString(),
      items: publishingQueue,
      format: "json" as const
    };
  }
}

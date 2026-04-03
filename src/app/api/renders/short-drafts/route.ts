import { NextRequest, NextResponse } from "next/server";
import { listRenderedDrafts } from "@/lib/server/rendered-short-repository";
import { renderShortDraftById } from "@/lib/server/short-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900; // Increased to 15 minutes for complex renders

export async function GET() {
  const data = await listRenderedDrafts();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { shortId?: string };

  if (!body.shortId) {
    return NextResponse.json({ error: "A shortId is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (event: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (e) {
          console.warn("[SSE] Failed to enqueue event, likely controller already closed:", e);
          isClosed = true;
        }
      };

      request.signal.addEventListener("abort", () => {
        console.log("[SSE] Request aborted by client, stopping render...");
        isClosed = true;
      });

      try {
        const data = await renderShortDraftById(
          body.shortId!,
          (message, percent) => {
            sendEvent({ type: "progress", message, percent });
          },
          request.signal
        );
        sendEvent({ type: "done", data });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to render short draft.";
        sendEvent({ type: "error", message });
      } finally {
        isClosed = true;
        try {
          controller.close();
        } catch (e) {
          // Ignore if already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}

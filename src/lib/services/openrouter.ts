import { GenerationSource, TextGenerationPackage } from "@/lib/types";

interface OpenRouterPayload {
  idea: string;
  transcriptSummary?: string;
  tonePreset?: string;
  platformPreset?: string;
}

function fallbackPackage({ idea, transcriptSummary, tonePreset, platformPreset }: OpenRouterPayload): TextGenerationPackage {
  const lower = idea.toLowerCase();
  const surgeonAngle = lower.includes("surgeon") || lower.includes("doctor");
  const progressAngle = lower.includes("fix") || lower.includes("lesson") || lower.includes("handicap");
  const summaryLine = transcriptSummary ? ` Transcript signal: ${transcriptSummary.slice(0, 180)}.` : "";

  const conceptAngle = surgeonAngle
    ? `Turn the round into a surgeon-golfer comedy short where the diagnosis line becomes the identity hook.${summaryLine}`
    : progressAngle
      ? `Frame the short around visible improvement so the viewer sees proof fast.${summaryLine}`
      : `Package the idea as a fast-cut golf short with one strong opener, one reaction beat, and one payoff.${summaryLine}`;

  return {
    conceptAngle,
    hookOptions: [
      `This idea gets good the second the first bad decision is spoken out loud.`,
      `The funniest line in "${idea}" should land inside the first two seconds.`,
      `This short works best if the opener feels like a confession before the payoff hits.`
    ],
    captionOptions: [
      `${idea} but cut like a creator short so the story lands before anyone swipes away.`,
      `The hook, the reaction, and the payoff are all right there if we keep the pacing tight.`,
      `Golf content works best when the pain is relatable and the payoff arrives quickly.`
    ],
    hashtagOptions: ["#GolfShorts", "#GolfTok", "#ScrubsAndClubs", "#GolfReels", "#GolfHumor"],
    ctaOptions: [
      "Comment FULL if you want the whole round breakdown.",
      "Save this before your next round.",
      "Tag the friend who always says this on the course."
    ],
    funnyCaptionIdeas: surgeonAngle
      ? ["Doctor says it's bad", "Swing status: unstable", "Diagnosis confirmed"]
      : ["Worst club choice ever", "Every golfer says this", "This changed the whole round"],
    clickbaitTitleOptions: [
      `The bunker shot NO ONE expected 🤯`,
      `Is this the worst decision in golf history?`,
      `How to fix your swing in 5 seconds flat`
    ],
    firstCommentOptions: [
      `Would you have used a 56 or a 60 degree wedge here?`,
      `Tag the friend who always does this on the course.`,
      `What's your biggest weakness right now: driving or putting?`
    ],
    subtitleToneSuggestion: tonePreset ?? "Bold, quick subtitles with emphasized golf words",
    editingVibeSuggestion: platformPreset ? `Edit for ${platformPreset} with a cold open and fast retention pacing.` : "Use a cold open, fast cuts, and one beat of tension before the payoff.",
    provider: "fallback",
    warning: "OpenRouter not configured or unavailable. Using fallback package generation."
  };
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in OpenRouter response.");
  }

  return JSON.parse(text.slice(start, end + 1)) as Partial<TextGenerationPackage>;
}

export async function generateTextPackage(payload: OpenRouterPayload): Promise<TextGenerationPackage> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "openrouter/free";

  if (!apiKey) {
    return fallbackPackage(payload);
  }

  const systemPrompt =
    "You generate creator-ready short-form golf video packages. Respond with strict JSON only. Keep hooks punchy, captions platform-aware, hashtags relevant, and funny caption ideas social-native.";

  const userPrompt = `Create a JSON object with keys: conceptAngle, hookOptions, captionOptions, hashtagOptions, ctaOptions, funnyCaptionIdeas, subtitleToneSuggestion, editingVibeSuggestion.

Idea/title: ${payload.idea}
Tone preset: ${payload.tonePreset ?? "Funny but useful golf creator"}
Platform preset: ${payload.platformPreset ?? "YouTube Shorts"}
Transcript summary: ${payload.transcriptSummary ?? "No transcript summary available yet"}

Rules:
- hookOptions: 3 to 5 items
- captionOptions: 3 items
- hashtagOptions: 4 to 6 items, include leading #
- ctaOptions: 2 to 3 items
- funnyCaptionIdeas: 3 to 5 items
- Keep output creator-friendly, high-retention, and golf-specific.
- Output JSON only.`;

  try {
    const response = await fetch(process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://127.0.0.1:3000",
        "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Scrubs & Clubs Studio"
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter returned no content.");
    }

    const parsed = extractJson(content);
    return {
      conceptAngle: parsed.conceptAngle ?? fallbackPackage(payload).conceptAngle,
      clickbaitTitleOptions: parsed.clickbaitTitleOptions?.filter(Boolean) ?? fallbackPackage(payload).clickbaitTitleOptions,
      firstCommentOptions: parsed.firstCommentOptions?.filter(Boolean) ?? fallbackPackage(payload).firstCommentOptions,
      hookOptions: parsed.hookOptions?.filter(Boolean) ?? fallbackPackage(payload).hookOptions,
      captionOptions: parsed.captionOptions?.filter(Boolean) ?? fallbackPackage(payload).captionOptions,
      hashtagOptions: parsed.hashtagOptions?.filter(Boolean) ?? fallbackPackage(payload).hashtagOptions,
      ctaOptions: parsed.ctaOptions?.filter(Boolean) ?? fallbackPackage(payload).ctaOptions,
      funnyCaptionIdeas: parsed.funnyCaptionIdeas?.filter(Boolean) ?? fallbackPackage(payload).funnyCaptionIdeas,
      subtitleToneSuggestion: parsed.subtitleToneSuggestion ?? fallbackPackage(payload).subtitleToneSuggestion,
      editingVibeSuggestion: parsed.editingVibeSuggestion ?? fallbackPackage(payload).editingVibeSuggestion,
      provider: "openrouter" satisfies GenerationSource,
      model
    };
  } catch {
    return fallbackPackage(payload);
  }
}

import { ClipStatus, ContentStatus, IntegrationType, PlatformType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "team@scrubsandclubs.studio" },
    update: {},
    create: {
      email: "team@scrubsandclubs.studio",
      name: "Scrubs & Clubs Team"
    }
  });

  const brand = await prisma.brand.upsert({
    where: { slug: "scrubs-and-clubs" },
    update: {},
    create: {
      name: "Scrubs & Clubs",
      slug: "scrubs-and-clubs",
      description: "Golf entertainment and improvement content with a surgeon-on-the-course brand angle."
    }
  });

  await prisma.brandMember.upsert({
    where: { brandId_userId: { brandId: brand.id, userId: user.id } },
    update: {},
    create: {
      brandId: brand.id,
      userId: user.id,
      role: "OWNER"
    }
  });

  const campaign = await prisma.campaign.upsert({
    where: { brandId_slug: { brandId: brand.id, slug: "road-to-handicap-36" } },
    update: {},
    create: {
      brandId: brand.id,
      name: "Road to Handicap 36",
      slug: "road-to-handicap-36",
      description: "Documenting the learning curve from early golf frustration to measurable progress.",
      color: "#5FB36A"
    }
  });

  const mediaAsset = await prisma.mediaAsset.create({
    data: {
      brandId: brand.id,
      providerAssetId: "drive_2surgeons_break100_ep04.mp4",
      providerType: "google_drive",
      filename: "2-surgeons-try-to-break-100-episode-4.mp4",
      mimeType: "video/mp4",
      durationSeconds: 1542,
      sourceFolder: "Drive/Long Form/Road to Handicap 36",
      driveUrl: "https://drive.google.com/mock/2-surgeons-break-100",
      tags: ["surgeons", "break100", "episode4", "long-form"]
    }
  });

  const sourceVideo = await prisma.sourceVideo.create({
    data: {
      brandId: brand.id,
      mediaAssetId: mediaAsset.id,
      title: "2 surgeons try to break 100",
      description: "Nine holes, too much confidence, and one brutal 5-wood decision.",
      transcriptStatus: "pending_import",
      analysisStatus: "mock_ready"
    }
  });

  const idea = await prisma.contentIdea.create({
    data: {
      brandId: brand.id,
      campaignId: campaign.id,
      createdById: user.id,
      sourceVideoId: sourceVideo.id,
      title: "The 5-wood decision that ruined the hole",
      category: "relatable",
      hook: "If you pull 5-wood here, this is exactly what happens.",
      concept: "Break down the bad club choice and why high handicappers talk themselves into it.",
      viralityAngle: "Painfully relatable course management mistake",
      callToAction: "Comment with the club you always regret pulling",
      overlayText: "Worst 5-wood idea ever",
      thumbnailText: "Never hit this club here",
      status: ContentStatus.CLIP_SELECTED,
      targetPlatforms: [PlatformType.YOUTUBE_SHORTS, PlatformType.INSTAGRAM_REELS, PlatformType.TIKTOK]
    }
  });

  const clip = await prisma.clipSuggestion.create({
    data: {
      sourceVideoId: sourceVideo.id,
      title: "Bad 5-wood diagnosis",
      hook: "We knew this was the wrong club and hit it anyway.",
      startSeconds: 392,
      endSeconds: 446,
      reasonToWork: "The mistake is obvious, the reaction is funny, and the payoff happens fast.",
      caption: "Every beginner thinks this 5-wood is the smart play until contact says otherwise.",
      overlayText: "This club choice gets amateurs in trouble",
      subtitleStyle: "Large center captions with fairway green accent keywords",
      musicVibe: "Tense percussion into comedic release",
      viralFormat: "Mistake reveal -> instant consequence -> lesson takeaway",
      status: ClipStatus.ACCEPTED
    }
  });

  const editedShort = await prisma.editedShort.create({
    data: {
      brandId: brand.id,
      contentIdeaId: idea.id,
      clipSuggestionId: clip.id,
      title: "Bad 5-wood diagnosis",
      status: ContentStatus.READY_TO_POST,
      editPackageJson: {
        ratio: "9:16",
        introHook: "We knew this was wrong...",
        overlays: ["Bad club choice", "What we should've hit"],
        subtitles: "burned_in"
      },
      editorChecklist: [
        "Open on reaction frame",
        "Keep first sentence inside 1.2 seconds",
        "Add zoom on topped shot",
        "End on lesson takeaway"
      ]
    }
  });

  await prisma.captionVariant.createMany({
    data: [
      {
        editedShortId: editedShort.id,
        platform: PlatformType.YOUTUBE_SHORTS,
        caption: "This is why course management matters more than ego.",
        hashtags: ["#GolfShorts", "#BeginnerGolf", "#GolfMistakes"]
      },
      {
        editedShortId: editedShort.id,
        platform: PlatformType.TIKTOK,
        caption: "The confidence before a terrible 5-wood is always elite.",
        hashtags: ["#GolfTok", "#HighHandicap", "#RelatableGolf"]
      }
    ]
  });

  await prisma.publishingPlan.create({
    data: {
      brandId: brand.id,
      editedShortId: editedShort.id,
      platform: PlatformType.YOUTUBE_SHORTS,
      status: ContentStatus.SCHEDULED,
      caption: "This is why course management matters more than ego.",
      hashtags: ["#GolfShorts", "#BeginnerGolf", "#GolfMistakes"],
      scheduledFor: new Date("2026-03-30T18:00:00.000Z"),
      exportPayload: {
        fileName: "bad-5-wood-diagnosis.mp4",
        metricoolReady: true
      }
    }
  });

  await prisma.calendarItem.create({
    data: {
      brandId: brand.id,
      campaignId: campaign.id,
      title: "Bad 5-wood diagnosis",
      date: new Date("2026-03-30T18:00:00.000Z"),
      status: ContentStatus.SCHEDULED,
      platform: PlatformType.YOUTUBE_SHORTS
    }
  });

  await prisma.integrationConnection.createMany({
    data: [
      {
        brandId: brand.id,
        type: IntegrationType.GOOGLE_DRIVE,
        status: "mock_ready",
        accountLabel: "Scrubs & Clubs Drive"
      },
      {
        brandId: brand.id,
        type: IntegrationType.CAPCUT,
        status: "requires_real_api_validation",
        accountLabel: "CapCut account connected manually"
      },
      {
        brandId: brand.id,
        type: IntegrationType.METRICOOL,
        status: "export_mode",
        accountLabel: "Metricool workspace"
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

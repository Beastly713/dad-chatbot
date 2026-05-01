import { Document } from "@langchain/core/documents";

export const ALCOHOL_PHASE1_KB_VERSION = "phase1-v1";

export const alcoholPhase1Docs = [
  new Document({
    pageContent:
      "When an urge to drink feels strong, try delaying the decision for 10 minutes. During that time, change your environment, take a few slow breaths, drink water, or message someone supportive. The goal is not to solve everything at once. The goal is to create a short pause between the urge and the action. Many urges rise, peak, and fade if you can safely get through the next few minutes.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "Urge delay for alcohol cravings",
    },
  }),

  new Document({
    pageContent:
      "A grounding exercise can help when a craving feels intense. Try naming five things you can see, four things you can feel, three things you can hear, two things you can smell, and one thing you can taste. Keep the goal small: return attention to the present moment and give the urge time to pass. This is not about forcing the craving away. It is about giving yourself a safer next few minutes.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "grounding",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "5-4-3-2-1 grounding for cravings",
    },
  }),

  new Document({
    pageContent:
      "If drinking feels hard to resist, reaching out can reduce the pressure of handling it alone. A simple message can be enough: “I’m having an urge to drink and I’m trying to wait it out. Can you stay in touch for a few minutes?” You do not need to explain everything perfectly. The next safe step can simply be letting one supportive person know that this moment is difficult.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "Contacting support during cravings",
    },
  }),

  new Document({
    pageContent:
      "A lapse does not erase the effort you have already made. It can be treated as information rather than proof of failure. A useful next step is to pause and ask: What was happening before I drank? Was I tired, stressed, lonely, around alcohol, or trying to avoid a feeling? The goal is not blame. The goal is to understand the pattern and choose one safer step now.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "relapse_support",
      riskCategory: "lapse_or_relapse",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "Nonjudgmental lapse reflection",
    },
  }),

  new Document({
    pageContent:
      "After drinking again, the safest next step is usually a small stabilizing action rather than self-criticism. Move away from more alcohol if you can, drink water, contact a trusted support person, and return to the next recovery-supporting choice. You do not have to solve the whole recovery journey tonight. Focus on interrupting the spiral and making the next hour safer.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "relapse_support",
      riskCategory: "lapse_or_relapse",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "Next safe step after a lapse",
    },
  }),

  new Document({
    pageContent:
      "Cravings are often temporary, even when they feel convincing in the moment. They can be affected by stress, reminders, mood, places, people, and routines. One helpful approach is to notice the craving as an event that is happening, not as a command you have to obey. Naming it can help: “This is an urge. It is uncomfortable, but I can take one safe step before deciding anything else.”",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "psychoeducation",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "Cravings are temporary",
    },
  }),

  new Document({
    pageContent:
      "Stress can make alcohol feel like a quick escape, but a small non-alcohol coping step can reduce the intensity enough to choose differently. Try one manageable action: step outside, take a shower, eat something, stretch, write down what you are feeling, or send a short message to someone safe. The goal is not perfect coping. The goal is to lower the pressure without using alcohol.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "Stress coping without alcohol",
    },
  }),

  new Document({
    pageContent:
      "Recovery is not all-or-nothing. Progress can include noticing triggers sooner, asking for support faster, reducing risky situations, learning from lapses, and returning to safer choices after a hard moment. A difficult day does not mean the whole process has failed. It can be an opportunity to identify what support, structure, or coping step would make the next similar moment safer.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "psychoeducation",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE1_KB_VERSION,
      title: "Recovery is not all-or-nothing",
    },
  }),
];
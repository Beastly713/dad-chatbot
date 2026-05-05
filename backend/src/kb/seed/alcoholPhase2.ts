import { Document } from "@langchain/core/documents";

export const ALCOHOL_PHASE2_KB_VERSION = "phase2-v1";

export const alcoholPhase2Docs = [
  new Document({
    pageContent:
      "When a craving feels very strong, shrink the goal to the next 10 minutes. Move your attention to one immediate action: put distance between yourself and alcohol, drink water, take slow breaths, or message one supportive person. The goal is not to solve recovery right now. The goal is to make the next few minutes safer.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "High craving: next 10 minutes",
      supportNeed: "immediate_coping",
      stateTag: "high_craving",
      deliveryStyle: "brief_practical",
    },
  }),

  new Document({
    pageContent:
      "If alcohol is nearby during an urge, creating even a little distance can make the next choice easier. Put the alcohol in another room, step outside, move closer to another person, or change what is in your hands. A small environment change can lower the pressure without needing a big decision.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Alcohol nearby: create distance",
      supportNeed: "environment_change",
      stateTag: "alcohol_nearby",
      deliveryStyle: "brief_practical",
    },
  }),

  new Document({
    pageContent:
      "When confidence feels low, too many options can make the moment harder. Pick one tiny action that does not require motivation: stand up, move to a different room, sip water, wash your face, or send a short text. The goal is not to feel confident first. The goal is to make one safer move while confidence is low.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Low confidence: reduce choices",
      supportNeed: "immediate_coping",
      stateTag: "low_confidence",
      deliveryStyle: "brief_practical",
    },
  }),

  new Document({
    pageContent:
      "Social pressure can make drinking feel harder to avoid. A simple exit or deflection can help: “I’m taking a break,” “I’m good for now,” or “I need to step out for a minute.” You do not need to explain everything. The goal is to reduce pressure and move toward a safer setting or person.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Social pressure: exit or deflect safely",
      supportNeed: "social_pressure",
      stateTag: "feeling_pressure",
      deliveryStyle: "brief_practical",
    },
  }),

  new Document({
    pageContent:
      "Feeling ashamed after drinking again is common, but shame can make it harder to return to safer choices. A lapse can be treated as information, not a verdict. Start with one stabilizing step: move away from more alcohol, drink water, rest somewhere safe, or contact someone supportive.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "relapse_support",
      riskCategory: "lapse_or_relapse",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Shame after lapse: nonjudgmental reset",
      supportNeed: "lapse_reset",
      stateTag: "shame_sensitive",
      deliveryStyle: "warm_brief",
    },
  }),

  new Document({
    pageContent:
      "After drinking, the next hour can still be made safer. Focus on stabilizing rather than judging yourself. Move away from additional alcohol if you can, drink water, eat something simple if appropriate, and contact a trusted person if being alone feels difficult. One safer next step still matters.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "relapse_support",
      riskCategory: "lapse_or_relapse",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Next hour safer after drinking",
      supportNeed: "post_lapse_stabilization",
      stateTag: "next_hour_safer",
      deliveryStyle: "brief_practical",
    },
  }),

  new Document({
    pageContent:
      "When distress and craving are both high, grounding can come before problem-solving. Try naming one thing you can see, one thing you can feel, and one sound you can hear. Then take one slow breath and choose one small action that makes drinking less immediate.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "grounding",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Grounding for distress and craving",
      supportNeed: "grounding",
      stateTag: "high_distress_high_craving",
      deliveryStyle: "calm_immediate",
    },
  }),

  new Document({
    pageContent:
      "Reaching out during an urge does not require a long explanation. A short message can be enough: “I’m having a hard urge to drink and I’m trying to wait it out. Can you stay in touch for a few minutes?” Asking for a few minutes of connection can reduce the pressure of handling the moment alone.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "alcohol_craving",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Contact support person during urge",
      supportNeed: "contact_support",
      stateTag: "contact_someone",
      deliveryStyle: "brief_practical",
    },
  }),

  new Document({
    pageContent:
      "Ambivalence is allowed. You do not have to feel completely ready to make a safer choice in this moment. A low-commitment step can still help: delay for a few minutes, change rooms, drink water, or simply say, “I do not have to decide everything right now.”",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "motivation_support",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "Ambivalence and low readiness",
      supportNeed: "low_readiness",
      stateTag: "ambivalence",
      deliveryStyle: "warm_brief",
    },
  }),

  new Document({
    pageContent:
      "When everything feels like too much, choose one tiny practical step. Put both feet on the floor, take one breath, drink water, move away from alcohol, or text one person. Tiny steps count because they interrupt the automatic path from urge to action.",
    metadata: {
      source: "internal_kb",
      substance: "alcohol",
      kbType: "coping",
      riskCategory: "general_support",
      userVisible: true,
      approved: true,
      version: ALCOHOL_PHASE2_KB_VERSION,
      title: "One tiny practical step",
      supportNeed: "one_next_step",
      stateTag: "overload",
      deliveryStyle: "brief_practical",
    },
  }),
];
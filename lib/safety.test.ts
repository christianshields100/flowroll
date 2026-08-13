import { describe, expect, it } from "vitest";
import { CRISIS_RESPONSE, detectCrisis } from "./safety";

describe("detectCrisis", () => {
  const positives = [
    "I want to kill myself",
    "i've been thinking about suicide a lot",
    "sometimes I feel suicidal after bad rolls",
    "I want to end my life",
    "thinking of ending my own life",
    "I just want to die",
    "I wish I was dead",
    "everyone would be better off without me",
    "I've been hurting myself",
    "I keep cutting myself",
    "struggling with self-harm again",
    "I don't want to be alive",
    "there's no reason to go on",
    "I'm going to end it all",
  ];
  it.each(positives)("flags crisis input: %s", (msg) => {
    expect(detectCrisis(msg)).toBe(true);
  });

  const negatives = [
    "I was killing it on the mat today",
    "that armbar is dying to be finished",
    "my grip strength is dead",
    "coach murdered me in sparring lol",
    "I got caught in a deathgrip choke",
    "this cut weight is brutal",
    "my cardio died in round 3",
    "should I train through a sore elbow?",
    "what submissions should I drill this week?",
  ];
  it.each(negatives)("does not flag normal gym talk: %s", (msg) => {
    expect(detectCrisis(msg)).toBe(false);
  });

  it("crisis response includes the 988 lifeline", () => {
    expect(CRISIS_RESPONSE).toContain("988");
    expect(CRISIS_RESPONSE).toContain("741741");
  });
});

import { detectInjury, INJURY_RESPONSE } from "./safety";

describe("detectInjury", () => {
  const positives = [
    "I think I injured my knee",
    "is my ankle sprained?",
    "I tore my meniscus last year",
    "worried about my ACL",
    "my shoulder got dislocated in a kimura",
    "I broke my finger gripping",
    "I might have a concussion",
    "I hit my head during a takedown",
    "my fingers are numb after training",
    "heard a pop in my elbow during an armbar",
    "my knee is swollen after class",
    "I can't straighten my arm",
    "should I see a doctor about this?",
    "can you diagnose what's wrong with my back",
    "is it ok to train through the pain?",
    "sharp pain in my ribs when I breathe",
    "pain in my neck that won't go away",
  ];
  it.each(positives)("flags injury/medical input: %s", (msg) => {
    expect(detectInjury(msg)).toBe(true);
  });

  const negatives = [
    "that choke hurt lol",
    "I'm sore from yesterday's session",
    "my ego took a beating today",
    "no pain no gain right",
    "what submissions should I drill?",
    "how do I escape side control",
    "my cardio was rough in round 3",
    "tough rolls today, feeling it",
  ];
  it.each(negatives)("does not flag normal gym talk: %s", (msg) => {
    expect(detectInjury(msg)).toBe(false);
  });

  it("injury response points to a professional", () => {
    expect(INJURY_RESPONSE).toMatch(/healthcare professional/i);
  });
});

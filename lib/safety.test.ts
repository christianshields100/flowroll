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

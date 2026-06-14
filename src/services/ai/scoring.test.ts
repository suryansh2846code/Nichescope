import { test, expect, describe } from "bun:test";
import { calculateLeadScore } from "./scoring";

describe("calculateLeadScore", () => {
  test("calculates minimum score of 0 when conditions are false", () => {
    expect(calculateLeadScore(false, 50, "other", "")).toBe(0);
  });

  test("adds 40 when isLead is true", () => {
    expect(calculateLeadScore(true, 50, "other", "")).toBe(40);
  });

  test("adds 30 when confidence is above 90", () => {
    expect(calculateLeadScore(false, 95, "other", "")).toBe(30);
  });

  test("does not add 30 when confidence is exactly 90 or below", () => {
    expect(calculateLeadScore(false, 90, "other", "")).toBe(0);
  });

  test("adds 20 when intent is seeking_recommendation or seeking_help", () => {
    expect(calculateLeadScore(false, 50, "seeking_recommendation", "")).toBe(20);
    expect(calculateLeadScore(false, 50, "seeking_help", "")).toBe(20);
  });

  test("adds 10 when caption length is above 30", () => {
    const longCaption = "This is a caption that has more than 30 characters in total length.";
    expect(calculateLeadScore(false, 50, "other", longCaption)).toBe(10);
  });

  test("calculates maximum score of 100 when all conditions are met", () => {
    const longCaption = "This is a caption that has more than 30 characters in total length.";
    expect(calculateLeadScore(true, 95, "seeking_help", longCaption)).toBe(100);
  });
});

import { WhiskyAnswers } from "@/lib/diagnosis";

export type PresetKey = "peat_strong" | "fruity" | "gift_5000" | "japanese_10000" | "beginner_mild";

export function answersFromPreset(preset: PresetKey): WhiskyAnswers {
  switch (preset) {
    case "peat_strong":
      return {
        use: "self",
        region: "islay",
        type: "single_malt",
        peat: "heavy",
        cask: ["any"],
        age: "any",
        drinking: "straight",
        budget: 8000,
        volume: 700,
      };
    case "fruity":
      return {
        use: "self",
        region: "speyside",
        type: "single_malt",
        peat: "none",
        cask: ["sherry"],
        age: "any",
        drinking: "rock",
        budget: 10000,
        volume: 700,
      };
    case "gift_5000":
      return {
        use: "gift",
        region: "any",
        type: "blended",
        peat: "none",
        cask: ["any"],
        age: "any",
        drinking: "any",
        budget: 5000,
        volume: 700,
      };
    case "japanese_10000":
      return {
        use: "self",
        region: "japan",
        type: "single_malt",
        peat: "none",
        cask: ["mizunara"],
        age: "any",
        drinking: "straight",
        budget: 10000,
        volume: 700,
      };
    case "beginner_mild":
      return {
        use: "self",
        region: "speyside",
        type: "single_malt",
        peat: "none",
        cask: ["bourbon"],
        age: "12",
        drinking: "rock",
        budget: 5000,
        volume: 700,
      };
    default:
      return {
        use: "self",
        region: "any",
        type: "single_malt",
        peat: "any",
        cask: ["any"],
        age: "any",
        drinking: "any",
        budget: 8000,
        volume: 700,
      };
  }
}

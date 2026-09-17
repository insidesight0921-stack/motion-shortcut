import type { PresentationProfile } from "./types";

const STORAGE_KEY = "flickey.presentation-profile.v1";

export const FIXED_MAPPINGS: PresentationProfile["mappings"] = {
  "next-slide": "swipe-right",
  "previous-slide": "swipe-left",
  "black-screen": "open-palm",
  "exit-presentation": "fist",
  "resource-1": "victory",
  "resource-2": "index",
};

export const DEFAULT_PROFILE: PresentationProfile = {
  id: "default",
  name: "나의 발표",
  app: "google-slides",
  presentationUrl: "",
  mappings: FIXED_MAPPINGS,
  resources: [
    { id: "resource-1", name: "자료 1", kind: "url", value: "" },
    { id: "resource-2", name: "자료 2", kind: "file", value: "" },
  ],
};

export function loadProfile(): PresentationProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PROFILE;
    return {
      ...DEFAULT_PROFILE,
      ...JSON.parse(saved),
      mappings: FIXED_MAPPINGS,
    } as PresentationProfile;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: PresentationProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

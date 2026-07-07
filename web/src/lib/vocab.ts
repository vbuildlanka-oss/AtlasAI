// Open vocabulary for zero-shot tagging. CLIP scores an image against every
// label ("a photo of a {label}") and we softmax the similarities. Because CLIP
// is open-vocabulary, this list can be anything - no retraining required.
export const TAG_VOCAB = [
  "dog", "cat", "bird", "horse", "person", "child", "crowd",
  "beach", "ocean", "mountain", "forest", "desert", "waterfall", "lake",
  "city", "skyline", "building", "street", "bridge", "road",
  "car", "bicycle", "motorcycle", "train", "boat", "airplane",
  "food", "pizza", "coffee", "cake", "fruit",
  "flower", "tree", "grass", "snow", "rain", "fog",
  "sunset", "sunrise", "night", "daytime",
  "indoor", "outdoor", "close-up", "aerial view",
  "black and white", "colorful", "vintage",
];

// Distinct hues for the 12 demo categories in the embedding galaxy.
export const CATEGORY_COLORS: Record<string, string> = {
  dog: "#f97316",
  cat: "#f43f5e",
  beach: "#22d3ee",
  mountains: "#a3e635",
  city: "#818cf8",
  food: "#fbbf24",
  coffee: "#d97706",
  flowers: "#ec4899",
  car: "#38bdf8",
  bicycle: "#2dd4bf",
  sunset: "#fb7185",
  forest: "#34d399",
  upload: "#ffffff",
};

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#94a3b8";
}

/** The three layers of the brand system and the rule categories in each. Shared by server and client. */
export const LAYERS = ["intent", "recognition", "execution"] as const;
export type Layer = (typeof LAYERS)[number];

export const LAYER_CATEGORIES: Record<Layer, readonly string[]> = {
  intent: [
    "purpose", "promise", "positioning", "audiences", "audience_needs", "category",
    "differentiators", "values", "value_propositions", "proof_points", "reasons_to_believe",
  ],
  recognition: [
    "logo", "logo_variants", "logo_clearspace", "logo_minimum_size", "primary_colors",
    "secondary_colors", "color_roles", "typography", "type_hierarchy", "voice_traits",
    "visual_signatures",
  ],
  execution: [
    "spacing", "grid", "alignment", "layout", "imagery", "photography", "illustration",
    "iconography", "graphic_devices", "borders", "shadows", "motion", "filter_treatments",
    "cta_patterns", "copy_patterns", "claims", "terminology",
  ],
};

export const ALL_CATEGORIES = [
  ...LAYER_CATEGORIES.intent,
  ...LAYER_CATEGORIES.recognition,
  ...LAYER_CATEGORIES.execution,
] as [string, ...string[]];

export function layerOfCategory(category: string): Layer {
  for (const layer of LAYERS) if (LAYER_CATEGORIES[layer].includes(category)) return layer;
  return "execution";
}

/** "logo_clearspace" → "LOGO", "primary_colors" → "COLOR". */
export function categoryPrefix(category: string) {
  const head = (category.split("_").find((p) => !["primary", "secondary", "audience", "value", "type", "visual", "graphic", "filter", "copy", "cta", "proof", "reasons"].includes(p)) ?? category.split("_")[0] ?? "RULE");
  const map: Record<string, string> = { colors: "COLOR", color: "COLOR", audiences: "AUDIENCE", values: "VALUE" };
  return (map[head] ?? head.replace(/[^a-z]/gi, "").replace(/s$/, "")).toUpperCase().slice(0, 10) || "RULE";
}

export function categoryLabel(category: string) {
  const s = category.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

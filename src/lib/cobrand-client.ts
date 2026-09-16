import { supabase } from "@/integrations/supabase/client";

export const ACCEPTED_TYPES =
  ".pdf,.png,.jpg,.jpeg,.webp,.svg,.pptx,.docx,.txt,.md,.markdown,.csv";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_PASS = 10;

export const LAYER_LABEL: Record<string, string> = {
  foundation: "Foundation",
  identity: "Identity",
  execution: "Execution",
};

export const LAYER_BLURB: Record<string, string> = {
  foundation: "Who the brand is — purpose, positioning, audience, values and proof.",
  identity: "How it shows up — logo, colour, type, voice and visual signatures.",
  execution: "How it is applied — exact tokens, layout, imagery, copy patterns and examples.",
};

export function ruleValue(value: unknown): string {
  if (value && typeof value === "object" && "raw" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)["raw"] ?? "");
  }
  return "";
}

export function isColor(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export async function listBrands() {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBrand(brandId: string) {
  const { data, error } = await supabase.from("brands").select("*").eq("id", brandId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSources(brandId: string) {
  const { data, error } = await supabase
    .from("source_files")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listRules(brandId: string) {
  const { data, error } = await supabase
    .from("rules")
    .select("*, rule_examples(*), context_tags(*)")
    .eq("brand_id", brandId)
    .neq("status", "superseded")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export type BrandRule = Awaited<ReturnType<typeof listRules>>[number];

export async function listGaps(brandId: string) {
  const { data, error } = await supabase
    .from("setup_gaps")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function listVersions(brandId: string) {
  const { data, error } = await supabase
    .from("brand_versions")
    .select("*")
    .eq("brand_id", brandId)
    .order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listChecks(brandId?: string) {
  let query = supabase
    .from("validation_checks")
    .select("*, brands(name)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (brandId) query = query.eq("brand_id", brandId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getCheck(checkId: string) {
  const { data, error } = await supabase
    .from("validation_checks")
    .select("*, brands(name, current_version), findings(*)")
    .eq("id", checkId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function signedAssetUrl(bucket: string, path: string) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadToBucket(bucket: string, brandId: string, file: File) {
  const path = `${brandId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createSourceFromFile(brandId: string, file: File, classification?: string) {
  const path = await uploadToBucket("brand-sources", brandId, file);
  const { data, error } = await supabase
    .from("source_files")
    .insert({
      brand_id: brandId,
      file_name: file.name,
      mime_type: file.type || null,
      kind: "file",
      storage_path: path,
      status: "queued",
      ...(classification ? { classification } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function createSourceFromText(
  brandId: string,
  title: string,
  text: string,
  classification?: string,
) {
  const { data, error } = await supabase
    .from("source_files")
    .insert({
      brand_id: brandId,
      file_name: title || "Pasted notes",
      kind: "text",
      pasted_text: text,
      mime_type: "text/plain",
      status: "queued",
      ...(classification ? { classification } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

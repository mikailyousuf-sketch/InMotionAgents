import { createServerSupabaseClient } from "@/lib/supabase/server";

export function renderTemplate(body: string, variables: Record<string, string | number | null | undefined>) {
  return body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => {
    const value = variables[key];
    return value == null ? "" : String(value);
  });
}

export async function getTemplate(templateId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error || !data) throw new Error(error?.message ?? "Template not found");
  return data;
}

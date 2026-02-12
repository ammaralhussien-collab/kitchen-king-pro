import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function translateText(apiKey: string, prompt: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a professional menu translator. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI error ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  let content = data.choices?.[0]?.message?.content || "";
  content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return content;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { force } = await req.json().catch(() => ({ force: false }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Translate categories
    const { data: cats } = await supabase.from("categories").select("id, name, name_en, name_de, name_ar");
    let catCount = 0;
    for (const cat of (cats || [])) {
      if (!force && cat.name_de && cat.name_ar) continue;
      const sourceName = cat.name_en || cat.name;
      try {
        const content = await translateText(LOVABLE_API_KEY, `Translate this restaurant menu category name. Keep international food terms as-is. Return ONLY valid JSON.\n\nInput: "${sourceName}"\n\nReturn JSON:\n{"name_de": "German", "name_ar": "Arabic"}`);
        const t = JSON.parse(content);
        const update: Record<string, string> = {};
        if (force || !cat.name_de) update.name_de = t.name_de;
        if (force || !cat.name_ar) update.name_ar = t.name_ar;
        if (Object.keys(update).length > 0) {
          await supabase.from("categories").update(update).eq("id", cat.id);
          catCount++;
        }
      } catch (e) {
        console.error(`Failed to translate category ${cat.id}:`, e);
      }
    }

    // Translate items
    const { data: items } = await supabase.from("items").select("id, name, name_en, name_de, name_ar, description, desc_en, desc_de, desc_ar");
    let itemCount = 0;
    for (const item of (items || [])) {
      const sourceDesc = item.desc_en || item.description || "";
      if (!force && item.name_de && item.name_ar && (sourceDesc === "" || (item.desc_de && item.desc_ar))) continue;
      const sourceName = item.name_en || item.name;
      try {
        const content = await translateText(LOVABLE_API_KEY, `Translate this restaurant menu item. Keep Italian/French/international dish names as-is (e.g., "Bruschetta"). Preserve numbers, units, prices, allergens, sizes. Return ONLY valid JSON.\n\nName: "${sourceName}"\nDescription: "${sourceDesc}"\n\nReturn JSON:\n{"name_de": "", "name_ar": "", "desc_de": "", "desc_ar": ""}`);
        const t = JSON.parse(content);
        const update: Record<string, string> = {};
        if (force || !item.name_de) update.name_de = t.name_de;
        if (force || !item.name_ar) update.name_ar = t.name_ar;
        if (sourceDesc && (force || !item.desc_de)) update.desc_de = t.desc_de;
        if (sourceDesc && (force || !item.desc_ar)) update.desc_ar = t.desc_ar;
        if (Object.keys(update).length > 0) {
          await supabase.from("items").update(update).eq("id", item.id);
          itemCount++;
        }
      } catch (e) {
        console.error(`Failed to translate item ${item.id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, categoriesTranslated: catCount, itemsTranslated: itemCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-all-menu error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

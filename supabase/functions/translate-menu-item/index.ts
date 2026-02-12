import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { item_id, force } = await req.json();
    if (!item_id) throw new Error("item_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: item, error } = await supabase
      .from("items")
      .select("name, name_en, name_de, name_ar, description, desc_en, desc_de, desc_ar")
      .eq("id", item_id)
      .single();

    if (error || !item) throw new Error("Item not found");

    const sourceName = item.name_en || item.name;
    const sourceDesc = item.desc_en || item.description || "";

    // Skip if already translated and not forcing
    if (!force && item.name_de && item.name_ar && (sourceDesc === "" || (item.desc_de && item.desc_ar))) {
      return new Response(JSON.stringify({ message: "Already translated", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Translate the following restaurant menu item. Keep dish names that are Italian/French/international as-is (e.g., "Bruschetta", "Crème brûlée"). Preserve numbers, units, prices, allergens, sizes (e.g., "500ml", "€", "2x"). Return ONLY valid JSON, no markdown.

Input:
- Name: "${sourceName}"
- Description: "${sourceDesc}"

Return JSON:
{
  "name_de": "German translation of name",
  "name_ar": "Arabic translation of name",
  "desc_de": "German translation of description",
  "desc_ar": "Arabic translation of description"
}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      throw new Error(`AI translation failed: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const translations = JSON.parse(content);

    const update: Record<string, string> = {};
    if (force || !item.name_de) update.name_de = translations.name_de;
    if (force || !item.name_ar) update.name_ar = translations.name_ar;
    if (sourceDesc && (force || !item.desc_de)) update.desc_de = translations.desc_de;
    if (sourceDesc && (force || !item.desc_ar)) update.desc_ar = translations.desc_ar;

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase.from("items").update(update).eq("id", item_id);
      if (updateErr) throw updateErr;
    }

    return new Response(JSON.stringify({ success: true, translated: update }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-menu-item error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

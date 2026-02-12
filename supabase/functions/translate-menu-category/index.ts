import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { category_id, force } = await req.json();
    if (!category_id) throw new Error("category_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cat, error } = await supabase
      .from("categories")
      .select("name, name_en, name_de, name_ar")
      .eq("id", category_id)
      .single();

    if (error || !cat) throw new Error("Category not found");

    const sourceName = cat.name_en || cat.name;

    if (!force && cat.name_de && cat.name_ar) {
      return new Response(JSON.stringify({ message: "Already translated", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Translate this restaurant menu category name. Keep international food terms as-is. Return ONLY valid JSON.

Input: "${sourceName}"

Return JSON:
{
  "name_de": "German translation",
  "name_ar": "Arabic translation"
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
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const translations = JSON.parse(content);

    const update: Record<string, string> = {};
    if (force || !cat.name_de) update.name_de = translations.name_de;
    if (force || !cat.name_ar) update.name_ar = translations.name_ar;

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await supabase.from("categories").update(update).eq("id", category_id);
      if (updateErr) throw updateErr;
    }

    return new Response(JSON.stringify({ success: true, translated: update }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-menu-category error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

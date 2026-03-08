import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { itemName, itemId } = await req.json();
    if (!itemName || !itemId) throw new Error("itemName and itemId required");

    const prompt = `Create a fun, colorful cartoon illustration of the food/kitchen item "${itemName}" on a clean solid white background. The style should be vibrant, playful, and easy to recognize at small sizes. No text, just the item drawn in a cute cartoon style with bold outlines.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) throw new Error("No image generated");

    // Extract base64 data and upload to storage
    const base64Data = imageDataUrl.split(",")[1];
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const filePath = `ai-generated/${itemId}.png`;
    const { error: uploadError } = await supabase.storage
      .from("item-images")
      .upload(filePath, binaryData, { contentType: "image/png", upsert: true });

    if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from("item-images").getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;

    // Update the item with the image URL
    const { error: updateError } = await supabase
      .from("stock_items")
      .update({ image_url: publicUrl })
      .eq("id", itemId);

    if (updateError) throw new Error(`Update error: ${updateError.message}`);

    return new Response(JSON.stringify({ image_url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

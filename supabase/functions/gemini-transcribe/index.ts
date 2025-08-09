import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();
    if (!audio) {
      return new Response(JSON.stringify({ error: "Missing 'audio' base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY not set");
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: "audio/wav", data: audio } },
            {
              text: "Transcribe the audio verbatim in the original language, then assess if it exhibits scam/phishing intent. Return strict JSON: {\n  \"text\": string,\n  \"risk_label\": one of [low, medium, high],\n  \"risk_score\": number between 0 and 1\n}. Do not include any extra text."
            }
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: "application/json"
      },
    };

    const res = await fetch(`${GEMINI_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Gemini error:", txt);
      return new Response(JSON.stringify({ error: "Gemini request failed", details: txt }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let result: { text: string; risk_label: string; risk_score: number } = {
      text: "",
      risk_label: "low",
      risk_score: 0.2,
    };
    try {
      const parsed = JSON.parse(raw);
      result = {
        text: typeof parsed.text === "string" ? parsed.text : raw,
        risk_label: ["low", "medium", "high"].includes(parsed.risk_label) ? parsed.risk_label : "low",
        risk_score: typeof parsed.risk_score === "number" ? parsed.risk_score : 0.2,
      };
    } catch {
      result.text = raw;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

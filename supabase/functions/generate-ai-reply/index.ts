import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { reviewId, reviewContent, starRating, businessName } = await req.json();

    if (!reviewId || !reviewContent || starRating === undefined || !businessName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: reviewId, reviewContent, starRating, businessName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt for the LLM
    const isLowRating = starRating <= 3;
    const systemPrompt = `You are a professional customer service representative for ${businessName}. Write a polite, professional, and brand-tailored response to a customer review. Keep it concise (2-4 sentences), warm, and authentic. Sign off with "— The ${businessName} Team".`;

    const userPrompt = isLowRating
      ? `Write an empathetic response to this ${starRating}-star review that acknowledges the issue, apologizes sincerely, and offers to make things right. Be genuine and not defensive.\n\nReview: "${reviewContent}"`
      : `Write a grateful response to this ${starRating}-star review that thanks the customer, highlights what you appreciate about their feedback, and invites them to return.\n\nReview: "${reviewContent}"`;

    // Call Google Gemini API
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    let generatedReply: string;

    if (geminiApiKey) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\n${userPrompt}` },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 200,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errBody = await geminiResponse.text();
        throw new Error(`Gemini API error (${geminiResponse.status}): ${errBody}`);
      }

      const geminiData = await geminiResponse.json();
      generatedReply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (!generatedReply) {
        throw new Error("Gemini returned an empty response");
      }
    } else {
      // Fallback: generate a simple template-based reply when no API key is configured
      generatedReply = isLowRating
        ? `Hi, we sincerely apologize for the experience you described. This is not the standard we hold ourselves to at ${businessName}. We'd love to make this right — please reach out to us directly so we can address your concerns. — The ${businessName} Team`
        : `Hi, thank you so much for your wonderful review! We truly appreciate your kind words and are thrilled you had a great experience with ${businessName}. We look forward to serving you again in the future. — The ${businessName} Team`;
    }

    // Write the generated reply back to the reviews table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error: dbError } = await supabase
      .from("reviews")
      .update({ ai_reply_draft: generatedReply })
      .eq("id", reviewId)
      .select("id, ai_reply_draft")
      .single();

    if (dbError) {
      throw new Error(`Failed to update review: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, reviewId: data.id, aiReplyDraft: data.ai_reply_draft }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

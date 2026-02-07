import { NextResponse } from "next/server";

type NegotiatorRequest = {
  query?: string;
  context?: Record<string, unknown>;
};

const systemPrompt = `
You are the LifeMosaic AI Coach. Given a user's question about a decision,
return ONLY valid JSON (no markdown, no extra text) in this exact shape:

{
  "query": "...",
  "answer": "yes|no|maybe",
  "breakdown": {
    "cost_impact": {
      "immediate": number,
      "budget_pct": number,
      "opportunity_cost": string
    },
    "health_impact": {
      "calories": number,
      "nutrition_quality": number,
      "wellness_change": number
    },
    "sustainability_impact": {
      "co2e_kg": number,
      "packaging_waste": "Low|Medium|High",
      "score_change": number
    }
  },
  "alternative": {
    "suggestion": string,
    "cost": number,
    "cost_saved": number,
    "calories": number,
    "health_improvement": number,
    "sustainability_improvement": number,
    "reasoning": string
  },
  "final_recommendation": string
}

Be realistic but concise. Always fill all fields.
If information is missing, make a reasonable assumption.
Return ONLY the JSON object, nothing else.
`;

const parseJson = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("invalid_json");
    }
    return JSON.parse(raw.slice(start, end + 1));
  }
};

export async function POST(request: Request) {
  let payload: NegotiatorRequest = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 500 });
  }
  const userContent =
    payload.context && Object.keys(payload.context).length > 0
      ? `${query}\n\nContext: ${JSON.stringify(payload.context)}`
      : query;
  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.6,
      }),
    });
    if (!completion.ok) {
      return NextResponse.json({ error: "coach_unavailable" }, { status: 500 });
    }
    const data = await completion.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";
    const parsed = parseJson(raw);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "coach_unavailable" }, { status: 500 });
  }
}

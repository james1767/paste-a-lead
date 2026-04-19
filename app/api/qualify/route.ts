import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type QualificationResult = {
  status: "Qualified" | "Needs More Info" | "Not Qualified";
  score: number;
  reasons: string[];
  missingInfo: string[];
  suggestedReply: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadText = body?.leadText;

    if (!leadText || typeof leadText !== "string") {
      return NextResponse.json(
        { error: "Lead text is required." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing from .env.local" },
        { status: 500 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: `
You are a lead qualification assistant for service businesses.

Your job is to decide whether a pasted lead message is worth pursuing.

Evaluate the lead using these five criteria:
1. Relevance
2. Intent
3. Need
4. Timing
5. Ability to buy

Scoring rules:
- Score each criterion from 0 to 10
- Add them for a total out of 50
- Convert that into a score out of 100

Status rules:
- 80 to 100 = Qualified
- 50 to 79 = Needs More Info
- 0 to 49 = Not Qualified

Be commercially sensible:
- Reward clear business relevance, genuine buying intent, active need, near-term timing, and signs the lead is commercially real
- Penalize vague curiosity, unrealistic expectations, lack of need, and weak purchase signals
- Do not invent facts that are not in the message

Return STRICT JSON only in exactly this shape:
{
  "status": "Qualified" | "Needs More Info" | "Not Qualified",
  "score": number,
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "missingInfo": ["item 1", "item 2"],
  "suggestedReply": "short practical reply"
}

Rules for output:
- reasons: 2 to 4 short bullet-style strings
- missingInfo: include only genuinely missing details
- suggestedReply: plain English, concise, useful, ready to send
- no markdown
- no extra text outside JSON
              `.trim(),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Lead message:\n${leadText}`,
            },
          ],
        },
      ],
    });

    const text = response.output_text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "The model returned an empty response." },
        { status: 500 }
      );
    }

    let parsed: QualificationResult;

    try {
      parsed = JSON.parse(text) as QualificationResult;
    } catch {
      return NextResponse.json(
        {
          error: "The model returned invalid JSON.",
          raw: text,
        },
        { status: 500 }
      );
    }

    if (
      !parsed.status ||
      typeof parsed.score !== "number" ||
      !Array.isArray(parsed.reasons) ||
      !Array.isArray(parsed.missingInfo) ||
      typeof parsed.suggestedReply !== "string"
    ) {
      return NextResponse.json(
        { error: "The model returned an unexpected response shape." },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Qualification error:", error);

    return NextResponse.json(
      { error: "Unable to process this lead right now." },
      { status: 500 }
    );
  }
}
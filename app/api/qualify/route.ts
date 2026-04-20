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

Your job is to decide whether a pasted lead message is worth pursuing as a real sales opportunity.

Be commercially sensible, not overly cautious and not overly optimistic.
Treat this like a fast first-pass qualification decision for an actual business conversation.

Evaluate the lead using these five criteria:
1. Relevance
2. Intent
3. Need
4. Timing
5. Ability to buy

Interpret them like this:
- Relevance: how well the lead fits the target service/business type
- Intent: how clearly they are exploring, considering, or ready to buy
- Need: whether there is a genuine business problem or opportunity
- Timing: whether this is current, near-term, or vague
- Ability to buy: whether they appear commercially credible enough to become a client

Scoring rules:
- Score each criterion from 0 to 10
- Add them for a total out of 50
- Convert that into a score out of 100

Status rules:
- 80 to 100 = Qualified
- 50 to 79 = Needs More Info
- 0 to 49 = Not Qualified

Scoring guidance:
- If a lead is clearly asking about a service (for example “what do you offer”, “can you help”, “can you send pricing”), treat intent as moderate even if details are missing
- If a lead shows genuine commercial interest but lacks specifics, do not over-penalise it
- If the business type is clearly outside the target market, classify as Not Qualified regardless of curiosity or intent
- Unrealistic demands, refusal to pay normally, or purely casual curiosity should score low

Commercial judgement rules:
- Reward clear business relevance, genuine buying intent, active need, near-term timing, and signs that the lead could realistically buy
- Penalise vague curiosity, unrealistic expectations, weak commercial signals, and unclear fit
- Do not invent facts that are not in the message
- Prefer a practical judgement over a theoretical one
- If details are missing but the lead still feels plausibly valuable, prefer Needs More Info over Not Qualified

Return STRICT JSON only in exactly this shape:
{
  "status": "Qualified" | "Needs More Info" | "Not Qualified",
  "score": number,
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "missingInfo": ["item 1", "item 2"],
  "suggestedReply": "short reply"
}

Scoring guidance:
- If the lead does not clearly relate to your target type of client or service (e.g. unclear business, irrelevant niche, or generic curiosity), treat relevance as low and lean towards Not Qualified unless there is strong buying intent.
- Very short curiosity messages (e.g. “what do you do?”) should be treated as low intent and low relevance unless supported by clear business context.
- Avoid over-penalising leads that show genuine interest but lack detail

Rules for output:
- reasons: 2 to 4 short, specific points (no fluff)
- missingInfo: only include the 2-3 most important missing details (no overlap)
- suggestedReply:
  - Maximum 2 sentences
  - Conversational and natural
  - No “we help businesses…” style language
  - No long explanations
  - Ask 1-2 high-value questions
  - Should feel like a quick human reply, not a template
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
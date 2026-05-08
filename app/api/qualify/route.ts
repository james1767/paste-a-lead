import OpenAI from "openai";
import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const postHeaders = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

export function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

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

type LeadTypeId =
  | "general-business"
  | "professional-services"
  | "sales-agency"
  | "crypto-tax";

const VALID_LEAD_TYPES: LeadTypeId[] = [
  "general-business",
  "professional-services",
  "sales-agency",
  "crypto-tax",
];

function normaliseLeadType(value: unknown): LeadTypeId {
  if (typeof value === "string" && (VALID_LEAD_TYPES as string[]).includes(value)) {
    return value as LeadTypeId;
  }
  return "general-business";
}

function leadTypeLabel(id: LeadTypeId): string {
  switch (id) {
    case "crypto-tax":
      return "Crypto Tax Enquiry";
    case "professional-services":
      return "Professional Services Enquiry";
    case "sales-agency":
      return "Sales / Agency Enquiry";
    case "general-business":
    default:
      return "General Business Enquiry";
  }
}

function categoryGuidance(leadType: LeadTypeId): string {
  switch (leadType) {
    case "crypto-tax":
      return `
For this category — and ONLY this category — crypto and tax relevance materially affect scoring.

Reward strongly:
- Real crypto activity: trades across exchanges, DeFi, NFTs, staking, mining.
- Tax pressure: HMRC contact, nudge letters, unreported gains, approaching deadlines, penalties, investigations.
- Ongoing complexity (multiple wallets/exchanges, multi-year history, business activity).

Penalise:
- Casual curiosity with no actual tax issue.
- Requests for free general advice with no engagement intent.
- Enquiries clearly outside scope without strong intent signals.
`.trim();

    case "professional-services":
      return `
This category covers professional service practitioners — legal, advisory, consultancy, and similar professional client services.

Score on:
- Fit: a clearly described professional problem, change trigger, or scoped piece of work that maps to a professional service offering within this category.
- Intent: language indicating they are choosing a provider rather than browsing.
- Urgency: stated deadlines, change triggers (handover, dispute, project start), or time pressure.
- Specificity: business size/sector, scope of work, timeline, named decision-maker, stated outcome, budget signals.

Reward leads that combine a clear professional problem with intent to engage a provider near-term.
Penalise free-advice fishing, anonymous unsigned messages, and enquiries with no professional context.

Do NOT consider or reference any out-of-category criteria.
`.trim();

    case "sales-agency":
      return `
This category covers inbound proposals, agency pitches, and lead-gen offers being evaluated by the recipient.

Score on:
- Fit: does this offer plausibly map to a real business need worth evaluating within this category?
- Intent: is the sender clear about what they're offering and what they want the recipient to do next?
- Urgency: stated timelines, change-trigger framing, or limited-availability framing.
- Specificity: relevance to the recipient's actual business, named outcome, evidence (case studies, references, results), realism of commercials.

Reward concrete, evidenced, well-targeted proposals with realistic commercials.
Penalise: unrealistic guarantees ("50 clients in 2 weeks"), pay-on-results-only with no context, generic mass-blast tone, anonymous senders, and offers that show no understanding of the recipient.

Do NOT consider or reference any out-of-category criteria.
`.trim();

    case "general-business":
    default:
      return `
This category covers general business enquiries — operational, partnership, or vendor-style contact.

Score on:
- Fit: a specific operational problem, project, or initiative relevant to the recipient's business.
- Intent: language indicating they want to move forward, not just browse.
- Urgency: stated deadlines, change triggers, or time pressure.
- Specificity: business context, role/decision-maker, timeline, scope, named deliverable, commercial-readiness signals.

Reward enquiries that combine a real business need with intent and at least some specifics.
Penalise vague curiosity, anonymous messages with no business context, or unfocused "tell me more" enquiries.

Do NOT consider or reference any out-of-category criteria.
`.trim();
  }
}

function buildSystemPrompt(leadType: LeadTypeId): string {
  const isCryptoTax = leadType === "crypto-tax";

  const isolationBlock = isCryptoTax
    ? `You are a lead qualification engine operating within a strictly defined category.

You MUST evaluate the lead ONLY within the selected category.

You MUST NOT reference, consider, or mention criteria from any other category.`
    : `You are a lead qualification engine operating within a strictly defined category.

You MUST evaluate the lead ONLY within the selected category.

You MUST NOT reference, consider, or mention criteria from any other category.

If the selected category is NOT crypto-tax, you MUST NOT mention:
- crypto
- tax
- HMRC
- accounting
- filings
- financial compliance

These are completely irrelevant unless the category is crypto-tax.`;

  const enforcementForbiddenTerms = isCryptoTax
    ? ""
    : `\n- The words crypto, tax, HMRC, accounting, filings, or financial compliance MUST NOT appear anywhere in reasons, missingInfo, or suggestedReply. If they do, the output is INVALID — regenerate it.`;

  return `
${isolationBlock}

Selected category: ${leadTypeLabel(leadType)}

${categoryGuidance(leadType)}

CRITICAL FINAL CHECK:

Before returning your answer, you MUST verify:

- All reasoning is strictly within the selected category
- No out-of-category concepts are mentioned
- If the category is NOT crypto-tax, there MUST be zero references to:
  crypto, tax, HMRC, accounting, filings, or financial compliance

If any of these appear, your answer is INVALID and must be regenerated.

You MUST enforce this strictly.

Scoring is based ONLY on the following four criteria, evaluated within the selected category context:
1. Fit — does the enquiry match the selected category?
2. Intent — exploring vs comparing vs ready to act, within this category.
3. Urgency — deadlines, change triggers, or time pressure expressed in the message.
4. Specificity — clarity of scope, budget signals, decision-maker, timeline, named outcomes.

Score each criterion from 0 to 10. Sum to a total out of 40, then convert to a score out of 100.

Status thresholds:
- 80–100 = Qualified
- 50–79  = Needs More Info
- 0–49   = Not Qualified

Universal scoring guidance:
- Clear category fit + intent + specifics → 80 to 95.
- Plausibly relevant but key facts missing → 55 to 70.
- No real opportunity, unrealistic, or mismatched to category → 0 to 40.
- Very short curiosity messages ("what do you do?", "how does this work?") → low intent + low fit → Not Qualified, regardless of category.

Strict consistency rules:
- The same input + same selected category must always produce the same classification and very similar score.
- Do not reinterpret the same message differently between evaluations.
- If input is ambiguous, choose a consistent interpretation and stick to it.
- Do not invent facts not present in the message.

ENFORCEMENT:
- If any reasoning includes references outside the selected category, the output is invalid.
- If any reason text, missing-info item, or suggested-reply text references concepts, terminology, or criteria from outside the selected category, the output is INVALID — regenerate it.${enforcementForbiddenTerms}
- Re-read your output before returning it. If it violates these rules, regenerate it.

Status rules:
- Use "Needs More Info" only when the lead is plausibly relevant for the selected category AND there is a believable opportunity, but key details are missing.
- Use "Not Qualified" for weak, vague, irrelevant, or out-of-category messages — do not default to "Needs More Info" for these.
- Use "Qualified" when there is a clear, specific need within the selected category, intent to act, and enough detail that a sensible next step is obvious.

Output rules:
- reasons: 2 to 4 short, specific points anchored in the message, expressed only in terms of the selected category.
- missingInfo: only the 2–3 most commercially important missing details for the selected category (no overlap, no boilerplate, no out-of-category items).
- suggestedReply:
  - Maximum 2 sentences.
  - Conversational and natural — like a quick human reply.
  - No template language.
  - Ask 1–2 high-value questions appropriate to the selected category only.
- Strict JSON only, no markdown, no extra text.

Return STRICT JSON in exactly this shape:
{
  "status": "Qualified" | "Needs More Info" | "Not Qualified",
  "score": number,
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "missingInfo": ["item 1", "item 2"],
  "suggestedReply": "short reply"
}
`.trim();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const leadText = body?.leadText;
    const leadType = normaliseLeadType(body?.leadType);

    if (!leadText || typeof leadText !== "string") {
      return NextResponse.json(
        { error: "Lead text is required." },
        { status: 400, headers: postHeaders }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing from .env.local" },
        { status: 500, headers: postHeaders }
      );
    }

    const response = await client.responses.create({
      model: "gpt-5.4",
      temperature: 0,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: buildSystemPrompt(leadType),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Lead category: ${leadTypeLabel(leadType)}\n\nLead message:\n${leadText}`,
            },
          ],
        },
      ],
    });

    const text = response.output_text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "The model returned an empty response." },
        { status: 500, headers: postHeaders }
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
        { status: 500, headers: postHeaders }
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
        { status: 500, headers: postHeaders }
      );
    }

    return NextResponse.json(parsed, { headers: postHeaders });
  } catch (error) {
    console.error("Qualification error:", error);

    return NextResponse.json(
      { error: "Unable to process this lead right now." },
      { status: 500, headers: postHeaders }
    );
  }
}

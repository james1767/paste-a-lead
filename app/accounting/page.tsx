"use client";

import { FormEvent, useState } from "react";

type QualificationResult = {
  status: "Qualified" | "Needs More Info" | "Not Qualified";
  score: number;
  reasons: string[];
  missingInfo: string[];
  suggestedReply: string;
  source?: "ai" | "fallback";
};

export default function HomePage() {
  const [leadText, setLeadText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QualificationResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!leadText.trim()) {
      setError("Please paste a lead message first.");
      return;
    }

    try {
      setLoading(true);

    const response = await fetch("/api/qualify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        leadText,
        context: "UK accounting firm specialising in crypto tax",
      }),
    });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function copyReply() {
    if (!result?.suggestedReply) return;
    await navigator.clipboard.writeText(result.suggestedReply);
  }
  function getStatusStyles(status: QualificationResult["status"]) {
  if (status === "Qualified") {
    return "bg-green-100 text-green-800 border-green-200";
  }

  if (status === "Needs More Info") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }

  return "bg-red-100 text-red-800 border-red-200";
}
  
function fillExampleLead(type: "strong" | "vague" | "badfit") {
  if (type === "strong") {
    setLeadText(
      "Hi, I run a bookkeeping firm and we’re looking for help getting more qualified calls next month. Can you send pricing and explain how it works?"
    );
  }

  if (type === "vague") {
    setLeadText("Hey, just wondering what you do exactly?");
  }

  if (type === "badfit") {
    setLeadText("Can you guarantee me 50 clients in a week?");
  }

  setResult(null);
  setError("");
}
  return (
    <main className="min-h-screen bg-white text-slate-900">
      
      <img
        src="/lq-icon.png"
        alt="LeadQualify"
        className="fixed top-5 left-5 w-8 h-8 z-50 opacity-80"
      />
      <section className="mx-auto max-w-5xl px-6 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">
            Simple lead qualification
          </p>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop wasting time on low-quality crypto tax leads
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Paste any enquiry, email, or DM and instantly see if it’s worth your time.
            Built specifically for UK accounting and crypto tax firms.
          </p>

          <p className="mt-4 text-sm text-slate-500">
            Filter out tyre-kickers, unrealistic expectations, and low-value enquiries
            before they hit your calendar.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              
<div className="space-y-3">
  <div className="flex flex-wrap items-center gap-2">
    <label
      htmlFor="leadText"
      className="text-sm font-medium text-slate-700"
    >
      Paste a lead message
    </label>

    <button
      type="button"
      onClick={() => fillExampleLead("strong")}
      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
    >
      Strong lead
    </button>

    <button
      type="button"
      onClick={() => fillExampleLead("vague")}
      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
    >
      Vague lead
    </button>

    <button
      type="button"
      onClick={() => fillExampleLead("badfit")}
      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
    >
      Bad fit
    </button>
  </div>

  <textarea
    id="leadText"
    value={leadText}
    onChange={(e) => setLeadText(e.target.value)}
    placeholder="Hi, I run a small accounting firm in Manchester and we’re looking for help getting more qualified calls. Can you send pricing and how it works?"
    className="min-h-[260px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-slate-500"
  />
</div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Checking..." : "Check this lead"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLeadText("");
                    setResult(null);
                    setError("");
                  }}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>

              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            {!result ? (
              <div className="flex h-full min-h-[320px] flex-col justify-between">
                <div>
                  <h2 className="text-xl font-semibold">What you’ll get</h2>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    <li>Qualified / Not Qualified / Needs More Info</li>
                    <li>Lead score out of 100</li>
                    <li>Short reasons you can trust</li>
                    <li>Missing info to ask for next</li>
                    <li>Suggested reply ready to send</li>
                  </ul>
                </div>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-medium text-slate-700">Example</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    “Hi, I’ve got some crypto trades and need help with tax. Not sure what I need exactly, can you advise?”
                </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-slate-500">Result</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium border ${getStatusStyles(
                        result.status
                      )}`}
                    >
                      {result.status}
                    </span>
                    <span className="text-sm text-slate-600">
                      Score: {result.score}/100
                    </span>
                    {result.source && (
                      <span className="text-xs text-slate-500">
                        Source: {result.source}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Why</h3>
                  <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                    {result.reasons.map((reason, index) => (
                      <li key={index}>• {reason}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Missing info
                  </h3>
                  {result.missingInfo.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                      {result.missingInfo.map((item, index) => (
                        <li key={index}>- {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      Nothing critical missing.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Suggested reply
                  </h3>
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                    {result.suggestedReply}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyReply}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  Copy reply
                </button>
              </div>
            )}
          </div>
        </div>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">Paste any message</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Email, DM, web enquiry, or cold reply.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">Get a clear decision</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Qualified, not qualified, or needs more information.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">Know what to say next</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the suggested reply to move the conversation forward.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
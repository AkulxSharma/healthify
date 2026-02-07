"use client";

import { useMemo, useState } from "react";

import { AlternativeSuggestion } from "@/components/negotiator/AlternativeSuggestion";
import { ImpactBreakdown } from "@/components/negotiator/ImpactBreakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NegotiatorResponse } from "@/types/negotiator";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: NegotiatorResponse;
};

type HabitNegotiatorProps = {
  userId: string;
};

export function HabitNegotiator({ userId }: HabitNegotiatorProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const hasMessages = messages.length > 0;
  const canSubmit = !loading && query.trim().length > 0;
  const placeholderText = "Ask me anything about a choice you’re making…";
  const recentMessage = useMemo(() => messages[messages.length - 1], [messages]);

  const handleAsk = async () => {
    if (!query.trim()) {
      return;
    }
    setError(null);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: query.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    try {
      setLoading(true);
      const res = await fetch("/api/negotiator/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.text, context: { userId } }),
      });
      if (!res.ok) {
        const message =
          res.status >= 500
            ? "Coach is unavailable right now. Please try again in a minute."
            : "Unable to get recommendation.";
        throw new Error(message);
      }
      const payload = (await res.json()) as NegotiatorResponse;
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: payload.final_recommendation,
        response: payload,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setShowDetails(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Coach is unavailable right now. Please try again in a minute.";
      setError(message);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: message,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ask Your AI Coach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder={placeholderText} value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button type="button" onClick={handleAsk} disabled={!canSubmit} className="w-full">
            {loading ? "Thinking..." : "Ask coach"}
          </Button>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coach conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasMessages ? (
            <p className="text-sm text-slate-400">Ask a question to start the conversation.</p>
          ) : (
            messages.map((message) => {
              if (message.role === "user") {
                return (
                  <div key={message.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">You</p>
                    <p className="mt-2 text-sm text-slate-100">{message.text}</p>
                  </div>
                );
              }
              const response = message.response;
              return (
                <div key={message.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">AI Coach</p>
                    <p className="mt-2 text-sm text-slate-100">{message.text}</p>
                    {response ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Recommendation: {response.answer.toUpperCase()}
                      </p>
                    ) : null}
                  </div>
                  {response ? (
                    <>
                      <ImpactBreakdown
                        costImpact={response.breakdown.cost_impact}
                        healthImpact={response.breakdown.health_impact}
                        sustainabilityImpact={response.breakdown.sustainability_impact}
                        expandAll={showDetails}
                        onToggleExpand={() => setShowDetails((prev) => !prev)}
                      />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-100">Recommended alternative</p>
                        <AlternativeSuggestion alternative={response.alternative} />
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-200">
                        {response.final_recommendation}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })
          )}
          {loading && recentMessage?.role === "user" ? (
            <p className="text-sm text-slate-400">Coach is thinking...</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { MealAnalysisCard } from "@/components/swaps/MealAnalysisCard";
import { RejectionModal } from "@/components/swaps/RejectionModal";
import { SwapSuggestion } from "@/components/swaps/SwapSuggestion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptSwap, analyzeMealPhoto, rejectSwap, suggestSwap } from "@/lib/swaps";
import type {
  MealAnalysis,
  SwapPreference,
  SwapRejectionReason,
  SwapSuggestion as SwapSuggestionType,
} from "@/types/swaps";

type MealForm = {
  name: string;
  ingredients: string;
  calories: string;
  protein: string;
  sugar: string;
  fat: string;
  cost: string;
  nutritionQuality: string;
  sustainability: string;
};

type SwapFlowProps = {
  onAccepted?: () => void;
};

const emptyForm: MealForm = {
  name: "",
  ingredients: "",
  calories: "",
  protein: "",
  sugar: "",
  fat: "",
  cost: "",
  nutritionQuality: "",
  sustainability: "",
};

const toNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
};

const toIngredients = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
};

export function SwapFlow({ onAccepted }: SwapFlowProps) {
  const [step, setStep] = useState<"capture" | "review" | "suggest">("capture");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [form, setForm] = useState<MealForm>(emptyForm);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<SwapSuggestionType | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedAlternative, setSelectedAlternative] = useState<SwapPreference>("healthier");
  const [rejecting, setRejecting] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  useEffect(() => {
    if (!photoFile) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photoFile]);

  const mealData = useMemo<MealAnalysis>(() => {
    return {
      meal_name: form.name.trim() || "Meal",
      ingredients: toIngredients(form.ingredients),
      estimated_calories: toNumber(form.calories),
      protein_g: toNumber(form.protein),
      sugar_g: toNumber(form.sugar),
      fat_g: toNumber(form.fat),
      cost_estimate: toNumber(form.cost),
      nutrition_quality: toNumber(form.nutritionQuality),
      sustainability_score: toNumber(form.sustainability),
    };
  }, [form]);

  const applyAnalysis = (data: MealAnalysis) => {
    setForm({
      name: data.meal_name ?? "",
      ingredients: (data.ingredients ?? []).join(", "),
      calories: data.estimated_calories != null ? String(Math.round(data.estimated_calories)) : "",
      protein: data.protein_g != null ? String(data.protein_g) : "",
      sugar: data.sugar_g != null ? String(data.sugar_g) : "",
      fat: data.fat_g != null ? String(data.fat_g) : "",
      cost: data.cost_estimate != null ? String(data.cost_estimate) : "",
      nutritionQuality: data.nutrition_quality != null ? String(data.nutrition_quality) : "",
      sustainability: data.sustainability_score != null ? String(data.sustainability_score) : "",
    });
    setStep("review");
    setSuccessMessage(null);
  };

  const handleAnalyzePhoto = async () => {
    setAnalysisError(null);
    setSuccessMessage(null);
    if (!photoFile) {
      setAnalysisError("Select a meal photo.");
      return;
    }
    if (photoFile.size > 10 * 1024 * 1024) {
      setAnalysisError("Photo must be under 10MB.");
      return;
    }
    try {
      setAnalysisLoading(true);
      const data = await analyzeMealPhoto(photoFile);
      applyAnalysis(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to analyze meal.";
      setAnalysisError(message);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleManualContinue = () => {
    setAnalysisError(null);
    if (!form.name.trim()) {
      setAnalysisError("Enter a meal name.");
      return;
    }
    setStep("review");
    setSuccessMessage(null);
  };

  const handleSuggest = async () => {
    setSuggestError(null);
    setSuggestion(null);
    setSuggesting(true);
    try {
      const result = await suggestSwap(mealData);
      setSuggestion(result);
      setStep("suggest");
      setSelectedAlternative(result.best_balanced);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to suggest swap.";
      setSuggestError(message);
    } finally {
      setSuggesting(false);
    }
  };

  const handleAccept = async () => {
    if (!suggestion) {
      return;
    }
    setAcceptError(null);
    setSuccessMessage(null);
    const alternativeData = suggestion[selectedAlternative];
    try {
      setAccepting(true);
      await acceptSwap({
        swapId: suggestion.swap_id,
        swapType: selectedAlternative,
        originalData: mealData,
        alternativeData,
      });
      const savings =
        typeof alternativeData.savings === "number"
          ? alternativeData.savings
          : undefined;
      setSuccessMessage(
        savings != null
          ? `Swap saved about $${savings.toFixed(2)}.`
          : "Swap accepted and logged."
      );
      onAccepted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to accept swap.";
      setAcceptError(message);
    } finally {
      setAccepting(false);
    }
  };

  const handleReset = () => {
    setStep("capture");
    setPhotoFile(null);
    setPhotoUrl(null);
    setForm(emptyForm);
    setSuggestion(null);
    setSuggestError(null);
    setAnalysisError(null);
    setAcceptError(null);
    setSuccessMessage(null);
    setSelectedAlternative("healthier");
    setShowRejectionModal(false);
  };

  const handleRejectAll = () => {
    setShowRejectionModal(true);
  };

  const handleSubmitRejection = async (
    reason: SwapRejectionReason,
    customReason: string | undefined,
    wouldTryModified: boolean
  ) => {
    if (!suggestion) {
      return;
    }
    setRejecting(true);
    try {
      const alternativeData = suggestion[selectedAlternative];
      await rejectSwap({
        swapId: suggestion.swap_id,
        originalMeal: mealData,
        alternative: alternativeData,
        swapType: selectedAlternative,
        reason,
        customReason,
        wouldTryModified,
      });
      handleReset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit feedback.";
      setAcceptError(message);
    } finally {
      setRejecting(false);
      setShowRejectionModal(false);
    }
  };

  return (
    <div className="space-y-4">
      {step === "capture" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-slate-100">Upload a meal photo</p>
            <div className="mt-3 space-y-3">
              <Input
                type="file"
                accept="image/*"
                onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              />
              <Button type="button" onClick={handleAnalyzePhoto} disabled={analysisLoading}>
                {analysisLoading ? "Analyzing..." : "Analyze photo"}
              </Button>
              {analysisError ? <p className="text-xs text-rose-300">{analysisError}</p> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-slate-100">Or enter a meal name</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Chicken burrito"
                className="flex-1"
              />
              <Button type="button" onClick={handleManualContinue}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step !== "capture" ? (
        <div className="space-y-4">
          <MealAnalysisCard
            mealData={mealData}
            imageUrl={photoUrl}
            onRequestAlternatives={handleSuggest}
            actionLabel={suggesting ? "Generating..." : "Get alternatives"}
          />
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm font-semibold text-slate-100">Edit meal details</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Meal name"
              />
              <Input
                value={form.ingredients}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, ingredients: event.target.value }))
                }
                placeholder="Ingredients (comma separated)"
              />
              <Input
                value={form.calories}
                onChange={(event) => setForm((prev) => ({ ...prev, calories: event.target.value }))}
                placeholder="Calories"
              />
              <Input
                value={form.protein}
                onChange={(event) => setForm((prev) => ({ ...prev, protein: event.target.value }))}
                placeholder="Protein (g)"
              />
              <Input
                value={form.sugar}
                onChange={(event) => setForm((prev) => ({ ...prev, sugar: event.target.value }))}
                placeholder="Sugar (g)"
              />
              <Input
                value={form.fat}
                onChange={(event) => setForm((prev) => ({ ...prev, fat: event.target.value }))}
                placeholder="Fat (g)"
              />
              <Input
                value={form.cost}
                onChange={(event) => setForm((prev) => ({ ...prev, cost: event.target.value }))}
                placeholder="Cost estimate ($)"
              />
              <Input
                value={form.nutritionQuality}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, nutritionQuality: event.target.value }))
                }
                placeholder="Nutrition quality (1-10)"
              />
              <Input
                value={form.sustainability}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, sustainability: event.target.value }))
                }
                placeholder="Sustainability (1-10)"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={handleSuggest} disabled={suggesting}>
                {suggesting ? "Generating..." : "Get alternatives"}
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                className="bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Start over
              </Button>
            </div>
            {suggestError ? <p className="mt-2 text-xs text-rose-300">{suggestError}</p> : null}
            {successMessage ? (
              <p className="mt-2 text-xs text-emerald-300">{successMessage}</p>
            ) : null}
            {acceptError ? <p className="mt-2 text-xs text-rose-300">{acceptError}</p> : null}
          </div>
        </div>
      ) : null}

      {step === "suggest" && suggestion ? (
        <div className="space-y-4">
          <SwapSuggestion
            original={mealData}
            alternatives={{
              healthier: suggestion.healthier,
              cheaper: suggestion.cheaper,
              eco: suggestion.eco,
            }}
            bestBalanced={suggestion.best_balanced}
            selected={selectedAlternative}
            onSelect={setSelectedAlternative}
            onAcceptSelected={handleAccept}
            onRejectAll={handleRejectAll}
            accepting={accepting}
          />
        </div>
      ) : null}
      <RejectionModal
        open={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        onSubmit={handleSubmitRejection}
        submitting={rejecting}
      />
    </div>
  );
}

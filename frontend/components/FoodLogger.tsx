"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabaseClient";
import { logFood } from "@/lib/events";
import type { Event } from "@/types/events";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
 
 type MealType = "breakfast" | "lunch" | "dinner" | "snack";
 
 type FoodAnalysis = {
   meal_name: string;
   estimated_calories?: number | null;
   ingredients?: string[];
  nutrition_quality?: number | null;
   nutrition_quality_score?: number | null;
  protein_g?: number | null;
  sugar_g?: number | null;
  fat_g?: number | null;
  cost_estimate?: number | null;
   sustainability_score?: number | null;
   meal_type?: MealType | null;
 };
 
 type FoodLoggerProps = {
   onLogged?: (event: Event) => void;
 };
 
 const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
 
 export function FoodLogger({ onLogged }: FoodLoggerProps) {
   const [tab, setTab] = useState("photo");
 
   const [title, setTitle] = useState("");
   const [calories, setCalories] = useState<string>("");
   const [ingredients, setIngredients] = useState<string>("");
   const [mealType, setMealType] = useState<MealType | "">("");
   const [nutritionQuality, setNutritionQuality] = useState<string>("");
   const [sustainabilityScore, setSustainabilityScore] = useState<string>("");
   const [saving, setSaving] = useState(false);
   const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
 
   const [photoFile, setPhotoFile] = useState<File | null>(null);
   const [photoUrl, setPhotoUrl] = useState<string | null>(null);
   const photoInputRef = useRef<HTMLInputElement | null>(null);
   const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
   const [photoError, setPhotoError] = useState<string | null>(null);
 
   const {
     supported: voiceSupported,
     isRecording,
     audioBlob,
     durationSeconds,
     startRecording,
     stopRecording,
     reset: resetAudio,
     error: recordError,
   } = useVoiceRecorder();
   const [voiceText, setVoiceText] = useState("");
   const [voiceError, setVoiceError] = useState<string | null>(null);
   const [analyzingVoice, setAnalyzingVoice] = useState(false);
 
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
 
   const badgeClass = (score?: number | null) => {
     const s = score ?? 0;
     if (s >= 8) return "border-emerald-400 bg-emerald-500/15 text-emerald-100";
     if (s >= 5) return "border-amber-400 bg-amber-500/15 text-amber-100";
     return "border-rose-400 bg-rose-500/15 text-rose-100";
   };
 
   const parseIngredients = (raw: string): string[] | undefined => {
     const trimmed = raw.trim();
     if (!trimmed) return undefined;
     return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
   };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunk));
    }
    return btoa(binary);
  };
 
   const handleAnalyzePhoto = async () => {
     setPhotoError(null);
     setStatus(null);
     if (!photoFile) {
       setPhotoError("Select a meal photo.");
       return;
     }
     if (photoFile.size > 10 * 1024 * 1024) {
       setPhotoError("Photo must be under 10MB.");
       return;
     }
     const form = new FormData();
     form.append("image", photoFile);
     try {
       setAnalyzingPhoto(true);
       const { data: sessionData } = await supabase.auth.getSession();
       const token = sessionData.session?.access_token;
       if (!token) {
         throw new Error("Log in to analyze photo.");
       }
       const res = await fetch(`${API_BASE}/food/analyze-photo`, {
         method: "POST",
         body: form,
         headers: { Authorization: `Bearer ${token}` },
       });
       if (!res.ok) {
         const text = await res.text();
         throw new Error(text || "Analysis failed.");
       }
      const data = (await res.json()) as FoodAnalysis & { nutrition_quality?: number | null };
       setTitle(data.meal_name || "");
       setCalories(
         data.estimated_calories != null ? String(Math.round(data.estimated_calories)) : ""
       );
       setIngredients((data.ingredients ?? []).join(", "));
       setMealType((data.meal_type as MealType | null) ?? "");
      {
        const q = data.nutrition_quality ?? data.nutrition_quality_score;
        setNutritionQuality(q != null ? String(q) : "");
      }
       setSustainabilityScore(
         data.sustainability_score != null ? String(data.sustainability_score) : ""
       );
     } catch (err) {
       const message = err instanceof Error ? err.message : "Unable to analyze photo.";
       setPhotoError(message);
     } finally {
       setAnalyzingPhoto(false);
     }
   };
 
   const handleAnalyzeVoice = async () => {
     setVoiceError(null);
     setStatus(null);
     const hasAudio = !!audioBlob && durationSeconds != null;
     const hasText = !!voiceText.trim();
     if (!hasAudio && !hasText) {
       setVoiceError("Record audio or enter a description.");
       return;
     }
     try {
       setAnalyzingVoice(true);
       const { data: sessionData } = await supabase.auth.getSession();
       const token = sessionData.session?.access_token;
       if (!token) {
         throw new Error("Log in to analyze voice.");
       }
       let body: BodyInit;
      if (hasAudio) {
        const arrayBuf = await audioBlob!.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuf);
        body = JSON.stringify({ audio_base64: base64 });
       } else {
         body = JSON.stringify({ description: voiceText });
       }
       const res = await fetch(`${API_BASE}/food/analyze-text`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         },
         body,
       });
       if (!res.ok) {
         const text = await res.text();
         throw new Error(text || "Analysis failed.");
       }
      const data = (await res.json()) as FoodAnalysis & { nutrition_quality?: number | null };
       setTitle(data.meal_name || "");
       setCalories(
         data.estimated_calories != null ? String(Math.round(data.estimated_calories)) : ""
       );
       setIngredients((data.ingredients ?? []).join(", "));
       setMealType((data.meal_type as MealType | null) ?? "");
      {
        const q = data.nutrition_quality ?? data.nutrition_quality_score;
        setNutritionQuality(q != null ? String(q) : "");
      }
       setSustainabilityScore(
         data.sustainability_score != null ? String(data.sustainability_score) : ""
       );
     } catch (err) {
       const message = err instanceof Error ? err.message : "Unable to analyze description.";
       setVoiceError(message);
     } finally {
       setAnalyzingVoice(false);
     }
   };
 
   const handleLog = async () => {
     setStatus(null);
     const parsedCalories = calories.trim() ? Number(calories) : null;
     if (parsedCalories != null && (Number.isNaN(parsedCalories) || parsedCalories < 0)) {
       setStatus({ type: "error", message: "Enter valid calories." });
       return;
     }
     const ing = parseIngredients(ingredients);
     const qual = nutritionQuality.trim() ? Number(nutritionQuality) : null;
     const sust = sustainabilityScore.trim() ? Number(sustainabilityScore) : null;
     if (qual != null && (Number.isNaN(qual) || qual < 1 || qual > 10)) {
       setStatus({ type: "error", message: "Nutrition quality must be 1–10." });
       return;
     }
     if (sust != null && (Number.isNaN(sust) || sust < 1 || sust > 10)) {
       setStatus({ type: "error", message: "Sustainability must be 1–10." });
       return;
     }
     const finalTitle = title.trim() || "Meal";
     try {
       setSaving(true);
       const event = await logFood(finalTitle, parsedCalories, ing, mealType || undefined, qual, sust);
       setStatus({ type: "success", message: "Meal logged." });
       onLogged?.(event);
       setTitle("");
       setCalories("");
       setIngredients("");
       setMealType("");
       setNutritionQuality("");
       setSustainabilityScore("");
       setPhotoFile(null);
       setPhotoUrl(null);
       resetAudio();
       setVoiceText("");
     } catch (err) {
       const message = err instanceof Error ? err.message : "Unable to log meal.";
       setStatus({ type: "error", message });
     } finally {
       setSaving(false);
     }
   };
 
   return (
     <div className="space-y-4">
       <Tabs value={tab} onValueChange={setTab}>
         <TabsList>
           <TabsTrigger value="photo">Photo</TabsTrigger>
           <TabsTrigger value="voice">Voice</TabsTrigger>
           <TabsTrigger value="manual">Manual</TabsTrigger>
         </TabsList>
         <TabsContent value="photo">
           <div className="space-y-3">
             <input
               ref={photoInputRef}
               type="file"
               accept="image/*"
               capture="environment"
               onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
               className="hidden"
             />
             <Button type="button" onClick={() => photoInputRef.current?.click()}>
               Select photo
             </Button>
             {photoUrl ? (
               <div className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-slate-800">
                 <Image src={photoUrl} alt="Meal photo" fill sizes="100vw" className="object-contain" unoptimized />
               </div>
             ) : null}
             {photoError ? <p className="text-sm text-rose-300">{photoError}</p> : null}
             <Button type="button" disabled={analyzingPhoto || !photoFile} onClick={handleAnalyzePhoto}>
               {analyzingPhoto ? "Analyzing..." : "Analyze photo"}
             </Button>
           </div>
         </TabsContent>
         <TabsContent value="voice">
           <div className="space-y-3">
             {recordError ? <p className="text-sm text-rose-300">{recordError}</p> : null}
             <div className="flex flex-wrap gap-3">
               {!isRecording ? (
                 <Button type="button" onClick={startRecording} disabled={!voiceSupported || analyzingVoice}>
                   Start recording
                 </Button>
               ) : (
                 <Button type="button" onClick={stopRecording} disabled={analyzingVoice}>
                   Stop recording
                 </Button>
               )}
               {audioBlob ? (
                 <Button type="button" onClick={resetAudio} disabled={analyzingVoice}>
                   Clear recording
                 </Button>
               ) : null}
             </div>
             <textarea
               value={voiceText}
               onChange={(e) => setVoiceText(e.target.value)}
               placeholder="Or type a description of the meal"
               className="min-h-[88px] w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
             />
             {voiceError ? <p className="text-sm text-rose-300">{voiceError}</p> : null}
             <Button type="button" disabled={analyzingVoice || (!audioBlob && !voiceText.trim())} onClick={handleAnalyzeVoice}>
               {analyzingVoice ? "Analyzing..." : "Analyze description"}
             </Button>
           </div>
         </TabsContent>
         <TabsContent value="manual">
          <p className="text-sm text-slate-300">Fill in details below to log your meal.</p>
         </TabsContent>
       </Tabs>
      <div className="space-y-3">
        <Input
          type="text"
          placeholder="Meal name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          type="number"
          min="0"
          step="1"
          placeholder="Estimated calories (optional)"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <Input
          type="text"
          placeholder="Ingredients (comma-separated)"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
        />
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType | "")}
          className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
        >
          <option value="">Select meal type</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
        <Input
          type="number"
          min="1"
          max="10"
          step="1"
          placeholder="Nutrition quality 1–10 (optional)"
          value={nutritionQuality}
          onChange={(e) => setNutritionQuality(e.target.value)}
        />
        <Input
          type="number"
          min="1"
          max="10"
          step="1"
          placeholder="Sustainability 1–10 (optional)"
          value={sustainabilityScore}
          onChange={(e) => setSustainabilityScore(e.target.value)}
        />
      </div>
       <div className="space-y-3">
         <div className="grid grid-cols-2 gap-2">
           <div className={`rounded-2xl border px-3 py-2 text-xs ${badgeClass(Number(nutritionQuality) || null)}`}>
             Nutrition quality {nutritionQuality || "-"}
           </div>
           <div className={`rounded-2xl border px-3 py-2 text-xs ${badgeClass(Number(sustainabilityScore) || null)}`}>
             Sustainability {sustainabilityScore || "-"}
           </div>
         </div>
         {status ? (
           <p className={status.type === "success" ? "text-sm text-emerald-200" : "text-sm text-rose-300"}>
             {status.message}
           </p>
         ) : null}
         <Button type="button" disabled={saving} onClick={handleLog} className="w-full">
           {saving ? "Saving..." : "Log meal"}
         </Button>
       </div>
     </div>
   );
 }

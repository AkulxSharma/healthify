"use client";
 
 import { useEffect, useState } from "react";
 import { useRouter } from "next/navigation";
 
 import { FoodLogger } from "@/components/FoodLogger";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { useSupabaseSession } from "@/hooks/useSupabaseSession";
 import type { Event } from "@/types/events";
 
 export default function FoodLogPage() {
   const router = useRouter();
   const { user, loading } = useSupabaseSession();
   const [loggedEvent, setLoggedEvent] = useState<Event | null>(null);
 
   useEffect(() => {
     if (!loading && !user) {
       router.replace("/auth");
     }
   }, [loading, router, user]);
 
   const handleLogged = (event: Event) => {
     setLoggedEvent(event);
   };
 
   if (loading) {
     return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
   }
 
   if (!user) {
     return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Redirecting...</div>;
   }
 
   return (
     <div className="min-h-screen bg-slate-950 text-slate-100">
       <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-10">
         <Card className="w-full">
           <CardHeader>
             <CardTitle>Log food</CardTitle>
             <CardDescription>Analyze a photo, describe by voice, or enter manually.</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             {loggedEvent ? (
               <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                 Logged {loggedEvent.title} {loggedEvent.amount ? `(~${Math.round(loggedEvent.amount)} cal)` : ""}.
               </div>
             ) : null}
             <FoodLogger onLogged={handleLogged} />
             {loggedEvent ? (
               <div className="flex flex-col gap-2 sm:flex-row">
                 <Button
                   type="button"
                   onClick={() => {
                     setLoggedEvent(null);
                   }}
                   className="flex-1"
                 >
                   Log another
                 </Button>
                 <Button type="button" onClick={() => router.push("/timeline")} className="flex-1">
                   View food timeline
                 </Button>
               </div>
             ) : null}
           </CardContent>
         </Card>
       </main>
     </div>
   );
 }

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PoseResults = {
  poseLandmarks?: Array<{ x: number; y: number }>;
  image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
};

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useVideoRecorder } from "@/hooks/useVideoRecorder";
import { uploadMovementTest } from "@/lib/movementTests";
import type { MovementPoseMetrics } from "@/types/movement";

const testOptions = ["Sit-to-stand", "Posture check", "Balance", "Stretch"];

export default function MovementCheckinPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const {
    supported,
    isRecording,
    stream,
    videoBlob,
    videoUrl,
    durationSeconds,
    startRecording,
    stopRecording,
    reset,
    error: recordError,
  } = useVideoRecorder();

  type PoseInstance = {
    setOptions: (options: {
      modelComplexity: number;
      smoothLandmarks: boolean;
      enableSegmentation: boolean;
      selfieMode: boolean;
    }) => void;
    onResults: (handler: (results: PoseResults) => void) => void;
    send: (input: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }) => Promise<void>;
    close?: () => void;
  };
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseRef = useRef<PoseInstance | null>(null);
  const animationRef = useRef<number | null>(null);
  const metricsRef = useRef({
    sumForm: 0,
    sumSymmetry: 0,
    sumRom: 0,
    frameCount: 0,
  });
  const poseConnectionsRef = useRef<Array<[number, number]> | null>(null);
  type DrawingConnectorFn = (
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }>,
    connections: Array<[number, number]>,
    options?: { color?: string; lineWidth?: number }
  ) => void;
  type DrawingLandmarksFn = (
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }>,
    options?: { color?: string; lineWidth?: number }
  ) => void;
  const drawingUtilsRef = useRef<{ drawConnectors?: DrawingConnectorFn; drawLandmarks?: DrawingLandmarksFn } | null>(null);
  const wasRecordingRef = useRef(false);
  const isRecordingRef = useRef(false);

  const [testType, setTestType] = useState(testOptions[0]);
  const [liveScores, setLiveScores] = useState<MovementPoseMetrics | null>(null);
  const [finalScores, setFinalScores] = useState<MovementPoseMetrics | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!previewRef.current) {
      return;
    }
    if (stream) {
      previewRef.current.srcObject = stream;
      previewRef.current.play().catch(() => null);
    } else {
      previewRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const clamp = useCallback((value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  }, []);

  const angleDegrees = useCallback(
    (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
      const abx = a.x - b.x;
      const aby = a.y - b.y;
      const cbx = c.x - b.x;
      const cby = c.y - b.y;
      const dot = abx * cbx + aby * cby;
      const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
      if (mag === 0) {
        return 0;
      }
      const cosine = clamp(dot / mag, -1, 1);
      return (Math.acos(cosine) * 180) / Math.PI;
    },
    [clamp]
  );

  const computeScores = useCallback(
    (landmarks: Array<{ x: number; y: number }>) => {
      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];
      const leftAnkle = landmarks[27];
      const rightAnkle = landmarks[28];

      if (
        !leftShoulder ||
        !rightShoulder ||
        !leftHip ||
        !rightHip ||
        !leftKnee ||
        !rightKnee ||
        !leftAnkle ||
        !rightAnkle
      ) {
        return null;
      }

      const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      const hipDiff = Math.abs(leftHip.y - rightHip.y);
      const symmetryScore = clamp(100 - ((shoulderDiff + hipDiff) / 0.2) * 100, 0, 100);

      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
      const torsoAngle = Math.abs((Math.atan2(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y) * 180) / Math.PI);
      const formScore = clamp(100 - (torsoAngle / 45) * 100, 0, 100);

      const leftKneeAngle = angleDegrees(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = angleDegrees(rightHip, rightKnee, rightAnkle);
      const leftRom = clamp(((leftKneeAngle - 70) / 110) * 100, 0, 100);
      const rightRom = clamp(((rightKneeAngle - 70) / 110) * 100, 0, 100);
      const romScore = (leftRom + rightRom) / 2;

      return {
        form_score: Math.round(formScore),
        symmetry_score: Math.round(symmetryScore),
        rom_score: Math.round(romScore),
      };
    },
    [angleDegrees, clamp]
  );

  const handlePoseResults = useCallback(
    (results: PoseResults) => {
      const landmarks = results.poseLandmarks as Array<{ x: number; y: number }> | undefined;
      const canvas = canvasRef.current;
      const drawingUtils = drawingUtilsRef.current;
      const poseConnections = poseConnectionsRef.current;
      if (canvas) {
        const image = results.image as HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
        const width = "videoWidth" in image ? image.videoWidth : image.width;
        const height = "videoHeight" in image ? image.videoHeight : image.height;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          if (landmarks && drawingUtils?.drawConnectors && drawingUtils?.drawLandmarks && poseConnections) {
            drawingUtils.drawConnectors(ctx, landmarks, poseConnections, {
              color: "#22c55e",
              lineWidth: 2,
            });
            drawingUtils.drawLandmarks(ctx, landmarks, { color: "#f97316", lineWidth: 1 });
          }
        }
      }

      if (!landmarks || !isRecordingRef.current) {
        return;
      }

      const scores = computeScores(landmarks);
      if (!scores) {
        return;
      }

      metricsRef.current.sumForm += scores.form_score;
      metricsRef.current.sumSymmetry += scores.symmetry_score;
      metricsRef.current.sumRom += scores.rom_score;
      metricsRef.current.frameCount += 1;

      setLiveScores({
        form_score: scores.form_score,
        symmetry_score: scores.symmetry_score,
        rom_score: scores.rom_score,
        frame_count: metricsRef.current.frameCount,
      });
    },
    [computeScores]
  );

  useEffect(() => {
    if (!supported) {
      return;
    }
    let active = true;
    import("@mediapipe/drawing_utils")
      .then((module) => {
        const typedModule = module as Partial<{
          drawConnectors: DrawingConnectorFn;
          drawLandmarks: DrawingLandmarksFn;
          default: Partial<{ drawConnectors: DrawingConnectorFn; drawLandmarks: DrawingLandmarksFn }>;
        }>;
        const drawConnectors = typedModule.drawConnectors;
        const drawLandmarks = typedModule.drawLandmarks;
        const fallback = typedModule.default;
        if (!active) {
          return;
        }
        drawingUtilsRef.current = {
          drawConnectors: drawConnectors ?? fallback?.drawConnectors,
          drawLandmarks: drawLandmarks ?? fallback?.drawLandmarks,
        };
      })
      .catch(() => {
        drawingUtilsRef.current = null;
      });

    type PoseCtor = new (options: { locateFile: (file: string) => string }) => PoseInstance;

    import("@mediapipe/pose")
      .then((module) => {
        const typedModule = module as Partial<{
          Pose: PoseCtor;
          POSE_CONNECTIONS: Array<[number, number]>;
          default: Partial<{ Pose: PoseCtor; POSE_CONNECTIONS: Array<[number, number]> }>;
        }>;
        const poseConstructor = typedModule.Pose ?? typedModule.default?.Pose;
        const poseConnections = typedModule.POSE_CONNECTIONS ?? typedModule.default?.POSE_CONNECTIONS ?? null;
        if (!active || !poseConstructor) {
          return;
        }
        const poseInstance = new poseConstructor({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        poseInstance.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          selfieMode: true,
        });
        poseInstance.onResults(handlePoseResults);
        poseRef.current = poseInstance;
        poseConnectionsRef.current = poseConnections;
      })
      .catch(() => {
        poseRef.current = null;
        poseConnectionsRef.current = null;
      });

    return () => {
      active = false;
      poseRef.current?.close?.();
      poseRef.current = null;
      poseConnectionsRef.current = null;
    };
  }, [handlePoseResults, supported]);

  useEffect(() => {
    if (!stream || !previewRef.current || !poseRef.current) {
      return;
    }
    let active = true;
    const run = async () => {
      if (!active || !poseRef.current || !previewRef.current) {
        return;
      }
      await poseRef.current.send({ image: previewRef.current });
      animationRef.current = requestAnimationFrame(run);
    };
    animationRef.current = requestAnimationFrame(run);
    return () => {
      active = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stream]);

  useEffect(() => {
    if (wasRecordingRef.current && !isRecording) {
      const frames = metricsRef.current.frameCount;
      if (frames > 0) {
        setFinalScores({
          form_score: Math.round(metricsRef.current.sumForm / frames),
          symmetry_score: Math.round(metricsRef.current.sumSymmetry / frames),
          rom_score: Math.round(metricsRef.current.sumRom / frames),
          frame_count: frames,
        });
      }
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  const handleStart = async () => {
    setFinalScores(null);
    setLiveScores(null);
    metricsRef.current = { sumForm: 0, sumSymmetry: 0, sumRom: 0, frameCount: 0 };
    await startRecording();
  };

  const handleReset = () => {
    reset();
    setFinalScores(null);
    setLiveScores(null);
    metricsRef.current = { sumForm: 0, sumSymmetry: 0, sumRom: 0, frameCount: 0 };
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!user) {
      setError("You must be logged in.");
      return;
    }
    if (!videoBlob || durationSeconds === null) {
      setError("Record a test before saving.");
      return;
    }
    try {
      setSaving(true);
      await uploadMovementTest(user.id, testType, videoBlob, durationSeconds, finalScores);
      handleReset();
      setSuccess("Movement test saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save movement test.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const subtitle = useMemo(() => {
    if (!supported) {
      return "Your browser does not support camera recording.";
    }
    if (isRecording) {
      return "Recording... keep moving for 30–60 seconds.";
    }
    return "Record a short movement test.";
  }, [isRecording, supported]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Movement test</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="mb-2 block text-sm text-slate-200">Test type</label>
              <div className="relative">
                <select
                  className="h-11 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 text-sm text-slate-100"
                  value={testType}
                  onChange={(event) => setTestType(event.target.value)}
                  disabled={saving || isRecording}
                >
                  {testOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-slate-200">Live preview</label>
              <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
                <video ref={previewRef} className="h-64 w-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {!isRecording ? (
                <Button type="button" onClick={handleStart} disabled={!supported || saving}>
                  Start test
                </Button>
              ) : (
                <Button type="button" onClick={stopRecording} disabled={saving}>
                  Stop test
                </Button>
              )}
              {videoBlob ? (
                <Button type="button" onClick={handleReset} disabled={saving}>
                  Clear recording
                </Button>
              ) : null}
            </div>
            {liveScores ? (
              <div className="text-sm text-slate-200">
                Live scores — Form: {liveScores.form_score}, Symmetry: {liveScores.symmetry_score},
                ROM: {liveScores.rom_score}
              </div>
            ) : null}
            {videoUrl ? (
              <div className="space-y-3">
                <label className="block text-sm text-slate-200">Playback</label>
                <div className="overflow-hidden rounded-2xl border border-slate-800">
                  <video className="h-64 w-full object-cover" controls src={videoUrl} />
                </div>
                {finalScores ? (
                  <div className="text-sm text-slate-200">
                    Final scores — Form: {finalScores.form_score}, Symmetry: {finalScores.symmetry_score},
                    ROM: {finalScores.rom_score}
                  </div>
                ) : null}
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save test"}
                </Button>
              </div>
            ) : null}
            {recordError ? <p className="text-sm text-rose-300">{recordError}</p> : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

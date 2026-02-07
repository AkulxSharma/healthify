"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseVoiceRecorder = {
  isRecording: boolean;
  audioBlob: Blob | null;
  durationSeconds: number | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  reset: () => void;
  supported: boolean;
  error: string | null;
};

export const useVoiceRecorder = (): UseVoiceRecorder => {
  const [supported, setSupported] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    setSupported(hasMedia);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setDurationSeconds(null);
    if (!supported) {
      setError("Browser does not support audio recording.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredType = "audio/webm";
      const options =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(preferredType)
          ? { mimeType: preferredType }
          : undefined;
      const recorder = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        if (startTimeRef.current) {
          const ms = Date.now() - startTimeRef.current;
          setDurationSeconds(Math.round(ms / 1000));
        }
        chunksRef.current = [];
        startTimeRef.current = null;
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to access microphone.";
      setError(message);
    }
  }, [supported]);

  const stopRecording = useCallback(async () => {
    setError(null);
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      setError("No active recording session.");
      return;
    }
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setDurationSeconds(null);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isRecording,
    audioBlob,
    durationSeconds,
    startRecording,
    stopRecording,
    reset,
    supported,
    error,
  };
};

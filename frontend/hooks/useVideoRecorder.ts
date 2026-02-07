"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseVideoRecorder = {
  supported: boolean;
  isRecording: boolean;
  stream: MediaStream | null;
  videoBlob: Blob | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  reset: () => void;
  error: string | null;
};

export const useVideoRecorder = (): UseVideoRecorder => {
  const [supported, setSupported] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const hasMedia =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window !== "undefined" &&
      "MediaRecorder" in window;
    setSupported(hasMedia);
  }, []);

  const previousUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!videoBlob) {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
        previousUrlRef.current = null;
      }
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);
    previousUrlRef.current = url;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoBlob]);

  const startRecording = useCallback(async () => {
    setError(null);
    setVideoBlob(null);
    setDurationSeconds(null);
    if (!supported) {
      setError("Browser does not support video recording.");
      return;
    }
    try {
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      setStream(userStream);
      chunksRef.current = [];
      const preferredType = "video/webm;codecs=vp9,opus";
      const fallbackType = "video/webm";
      let options: MediaRecorderOptions | undefined;
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported(preferredType)) {
          options = { mimeType: preferredType };
        } else if (MediaRecorder.isTypeSupported(fallbackType)) {
          options = { mimeType: fallbackType };
        }
      }
      const recorder = options ? new MediaRecorder(userStream, options) : new MediaRecorder(userStream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        if (startTimeRef.current) {
          const ms = Date.now() - startTimeRef.current;
          setDurationSeconds(Math.round(ms / 1000));
        }
        chunksRef.current = [];
        startTimeRef.current = null;
        setIsRecording(false);
        userStream.getTracks().forEach((t) => t.stop());
        setStream(null);
      };
      recorder.start();
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to access camera/microphone.";
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
    setVideoBlob(null);
    setDurationSeconds(null);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    supported,
    isRecording,
    stream,
    videoBlob,
    videoUrl,
    durationSeconds,
    startRecording,
    stopRecording,
    reset,
    error,
  };
};

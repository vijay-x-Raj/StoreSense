"use client";

/**
 * useLiveCamera — encapsulates the entire live camera lifecycle:
 *   1. Request browser camera via getUserMedia
 *   2. POST /api/camera/start → get sessionId
 *   3. Every 500 ms, capture a canvas snapshot → POST /api/camera/frame → update detections
 *   4. Every 5 s, poll /api/camera/analytics → update analytics
 *   5. Web Speech API: captures speech in real time → POST /api/audio/live-segment
 *   6. On stop: POST /api/camera/stop, stop speech recognition, release MediaStream
 *
 * Usage:
 *   const [cameraState, cameraControls, setVideoEl] = useLiveCamera(onAnalytics);
 *   // Pass setVideoEl as ref callback to the <video> element in VideoPanel
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  startLiveSession,
  submitFrame,
  stopLiveSession,
  getLiveCameraAnalytics,
  postLiveTranscriptSegment,
} from "@/lib/api";
import type { Detection, VideoAnalytics, TranscriptLine } from "@/lib/types";

const FRAME_INTERVAL_MS = 500;     // ~2 fps processing
const ANALYTICS_INTERVAL_MS = 5000;

// Web Speech API types (not in standard TS lib — defined inline for compatibility)
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvt) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvt = {
  error: string;
};

type SpeechRecognitionCtor = {
  new(): SpeechRecognitionInstance;
};

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionCtor;
    webkitSpeechRecognition: SpeechRecognitionCtor;
  }
}

export interface LiveCameraState {
  isLive: boolean;
  isStarting: boolean;
  error: string | null;
  sessionId: number | null;
  stream: MediaStream | null;
  detections: Detection[];
  analytics: VideoAnalytics | null;
  frameCount: number;
  transcript: TranscriptLine[];
  isMicActive: boolean;
}

export interface LiveCameraControls {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

type SetVideoEl = (el: HTMLVideoElement | null) => void;

export function useLiveCamera(
  onAnalyticsUpdate?: (analytics: VideoAnalytics) => void
): [LiveCameraState, LiveCameraControls, SetVideoEl] {
  const [state, setState] = useState<LiveCameraState>({
    isLive: false,
    isStarting: false,
    error: null,
    sessionId: null,
    stream: null,
    detections: [],
    analytics: null,
    frameCount: 0,
    transcript: [],
    isMicActive: false,
  });

  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyticsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSendingRef = useRef(false);
  const speechRef = useRef<SpeechRecognitionInstance | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  // Keep latest callback in ref to avoid stale closures
  const onAnalyticsRef = useRef(onAnalyticsUpdate);
  onAnalyticsRef.current = onAnalyticsUpdate;

  /** Called by VideoPanel to register the <video> DOM element */
  const setVideoEl: SetVideoEl = useCallback((el) => {
    videoElRef.current = el;
  }, []);

  const captureAndSend = useCallback(async () => {
    if (isSendingRef.current) return;
    const video = videoElRef.current;
    const sid = sessionIdRef.current;
    if (!video || !sid || video.readyState < 2) return;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }
    const canvas = captureCanvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob || !sessionIdRef.current) return;
      isSendingRef.current = true;
      try {
        const result = await submitFrame(sessionIdRef.current, blob);
        setState((prev) => ({
          ...prev,
          detections: result.detections as Detection[],
          frameCount: prev.frameCount + 1,
        }));
      } catch {
        // skip bad frames silently
      } finally {
        isSendingRef.current = false;
      }
    }, "image/jpeg", 0.75);
  }, []);

  const pollAnalytics = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const analytics = await getLiveCameraAnalytics(sid);
      setState((prev) => ({ ...prev, analytics }));
      onAnalyticsRef.current?.(analytics);
    } catch {
      // ignore
    }
  }, []);

  /** Initialize Web Speech API for real-time transcription */
  const startSpeechRecognition = useCallback((sid: number) => {
    const SpeechRecognitionAPI: SpeechRecognitionCtor | undefined =
      (window as Window & typeof globalThis).SpeechRecognition ||
      (window as Window & typeof globalThis).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn("Web Speech API not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "hi-IN";
    recognition.maxAlternatives = 1;

    speechStartTimeRef.current = Date.now();

    recognition.onresult = async (event: SpeechRecognitionResultEvent) => {
      const currentSid = sessionIdRef.current;
      if (!currentSid) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (!text) continue;
          const confidence = result[0].confidence ?? 0.9;
          const now = (Date.now() - speechStartTimeRef.current) / 1000;
          const segment = {
            text,
            start_time: Math.max(0, now - 3), // approximate start
            end_time: now,
            speaker: "Customer",
            language: "hi", // browser doesn't return language per result
            confidence,
          };
          try {
            const saved = await postLiveTranscriptSegment(currentSid, segment);
            setState((prev) => ({
              ...prev,
              transcript: [...prev.transcript, saved],
            }));
          } catch {
            // Persist failed — still show in UI
            setState((prev) => ({
              ...prev,
              transcript: [
                ...prev.transcript,
                {
                  id: Date.now(),
                  start_time: segment.start_time,
                  end_time: segment.end_time,
                  speaker: segment.speaker,
                  text: segment.text,
                  language: segment.language,
                  confidence: segment.confidence,
                },
              ],
            }));
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvt) => {
      console.warn("Speech recognition error:", event.error);
      // network / no-speech errors are non-fatal; restart recognition
      if (event.error !== "aborted" && event.error !== "not-allowed") {
        try { recognition.start(); } catch { /* already running */ }
      }
    };

    recognition.onend = () => {
      // Auto-restart so recognition stays continuous
      if (sessionIdRef.current) {
        try { recognition.start(); } catch { /* already running */ }
      }
    };

    recognition.start();
    speechRef.current = recognition;
    setState((prev) => ({ ...prev, isMicActive: true }));
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    if (speechRef.current) {
      try { speechRef.current.abort(); } catch { /* ignore */ }
      speechRef.current = null;
    }
    setState((prev) => ({ ...prev, isMicActive: false }));
  }, []);

  const start = useCallback(async () => {
    setState((prev) => ({ ...prev, isStarting: true, error: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true, // Request audio so microphone permission is guaranteed for Web Speech API
      });
      streamRef.current = stream;

      const session = await startLiveSession();
      sessionIdRef.current = session.session_id;

      setState((prev) => ({
        ...prev,
        isLive: true,
        isStarting: false,
        stream,
        sessionId: session.session_id,
        detections: [],
        frameCount: 0,
        transcript: [],
        error: null,
      }));

      frameIntervalRef.current = setInterval(captureAndSend, FRAME_INTERVAL_MS);
      analyticsIntervalRef.current = setInterval(pollAnalytics, ANALYTICS_INTERVAL_MS);
      pollAnalytics(); // immediate first fetch

      // Start live speech recognition
      startSpeechRecognition(session.session_id);
    } catch (err) {
      let msg = "Failed to start camera";
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          msg = "Camera permission denied. Please allow access and try again.";
        } else if (err.name === "NotFoundError") {
          msg = "No camera found on this device.";
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setState((prev) => ({ ...prev, isStarting: false, error: msg }));
    }
  }, [captureAndSend, pollAnalytics, startSpeechRecognition]);

  const stop = useCallback(async () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (analyticsIntervalRef.current) clearInterval(analyticsIntervalRef.current);
    frameIntervalRef.current = null;
    analyticsIntervalRef.current = null;

    stopSpeechRecognition();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sid) {
      try { await stopLiveSession(sid); } catch { /* best-effort */ }
    }

    setState((prev) => ({
      ...prev,
      isLive: false,
      stream: null,
      sessionId: null,
      detections: [],
    }));
  }, [stopSpeechRecognition]);

  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (analyticsIntervalRef.current) clearInterval(analyticsIntervalRef.current);
      stopSpeechRecognition();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const sid = sessionIdRef.current;
      if (sid) stopLiveSession(sid).catch(() => {});
    };
  }, [stopSpeechRecognition]);

  return [state, { start, stop }, setVideoEl];
}

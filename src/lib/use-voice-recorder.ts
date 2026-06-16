import { useRef, useState } from "react";

type VoiceRecorderState = "idle" | "recording" | "paused";

/**
 * Minimal voice recorder around MediaRecorder. Calls onComplete with the
 * recorded blob + duration (seconds) when recording stops. Requires HTTPS
 * (or localhost) and microphone permission.
 */
export function useVoiceRecorder(onComplete: (blob: Blob, durationSec: number) => void) {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const accumulatedMsRef = useRef(0);
  const timerRef = useRef(0);

  const currentElapsedMs = () => {
    if (recorderRef.current?.state === "recording") {
      return accumulatedMsRef.current + Date.now() - startedAtRef.current;
    }
    return accumulatedMsRef.current;
  };

  const updateElapsed = () => setElapsed(Math.round(currentElapsedMs() / 1000));

  const cleanup = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    accumulatedMsRef.current = 0;
    startedAtRef.current = 0;
    setState("idle");
    setElapsed(0);
  };

  const start = async () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Enregistrement audio non supporté par ce navigateur");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const durationSec = Math.max(1, Math.round(currentElapsedMs() / 1000));
      cleanup();
      if (blob.size > 0) onComplete(blob, durationSec);
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    accumulatedMsRef.current = 0;
    recorder.start();
    setState("recording");
    setElapsed(0);
    timerRef.current = window.setInterval(updateElapsed, 500);
  };

  const pause = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    accumulatedMsRef.current += Date.now() - startedAtRef.current;
    recorder.pause();
    setState("paused");
    updateElapsed();
  };

  const resume = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    startedAtRef.current = Date.now();
    recorder.resume();
    setState("recording");
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (recorder.state === "recording") {
      accumulatedMsRef.current += Date.now() - startedAtRef.current;
    }
    recorder.stop();
  };

  const cancel = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
  };

  return {
    state,
    recording: state === "recording",
    paused: state === "paused",
    active: state !== "idle",
    elapsed,
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}

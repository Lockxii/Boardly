import { useRef, useState } from "react";

/**
 * Minimal voice recorder around MediaRecorder. Calls onComplete with the
 * recorded blob + duration (seconds) when recording stops. Requires HTTPS
 * (or localhost) and microphone permission.
 */
export function useVoiceRecorder(onComplete: (blob: Blob, durationSec: number) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(0);

  const cleanup = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
    setElapsed(0);
  };

  const start = async () => {
    if (recording) return;
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
      const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      cleanup();
      if (blob.size > 0) onComplete(blob, durationSec);
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start();
    setRecording(true);
    setElapsed(0);
    timerRef.current = window.setInterval(
      () => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)),
      500,
    );
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const cancel = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    cleanup();
  };

  return { recording, elapsed, start, stop, cancel };
}

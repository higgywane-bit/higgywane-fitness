"use client";

import { useEffect, useRef, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reads member QR codes with the iPad / laptop camera. Uses the browser's BarcodeDetector
 * where it exists (Chrome, Android) and falls back to jsQR everywhere else (Safari).
 */
export function CameraScanner({ onCode, paused }: { onCode: (code: string) => void; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let last = { code: "", at: 0 };
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
      } catch {
        setError("Camera blocked. Allow camera access for this site in the browser settings.");
        return;
      }
      const v = video.current;
      if (!v || stopped) return;
      v.srcObject = stream;
      await v.play().catch(() => {});

      type Detector = { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> };
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector = BD ? new BD({ formats: ["qr_code", "code_128", "code_39", "ean_13"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;

      let busy = false;
      const tick = async () => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (busy || pausedRef.current || !v.videoWidth) return;
        busy = true;
        try {
          let value: string | undefined;
          if (detector) {
            value = (await detector.detect(v))[0]?.rawValue;
          } else if (ctx && jsQR) {
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = v.videoWidth * scale;
            canvas.height = v.videoHeight * scale;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            value = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data;
          }
          const now = Date.now();
          if (value && (value !== last.code || now - last.at > 4000)) {
            last = { code: value, at: now };
            onCodeRef.current(value);
          }
        } finally {
          // ~8 reads a second is plenty and keeps the iPad cool
          setTimeout(() => (busy = false), 120);
        }
      };
      raf = requestAnimationFrame(tick);
    }
    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-black ring-1 ring-hairline-strong">
      <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="size-[55%] max-w-64 rounded-[28px] border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
      </div>
      {error ? <p className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/80 p-3 text-sm">{error}</p> : null}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-3 right-3 bg-black/60 backdrop-blur"
        aria-label="Switch camera"
        onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
      >
        <SwitchCamera className="size-5" />
      </Button>
    </div>
  );
}

"use client";

import * as React from "react";

import { UploadSimple, CircleNotch, ArrowCounterClockwise, ArrowClockwise, DownloadSimple, UserSound } from "@phosphor-icons/react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ImageUploader() {
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Prompt disabled (server-side); keep for future UX toggles but unused
  // const [prompt, setPrompt] = React.useState<string>("");
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [resultDescription, setResultDescription] = React.useState<string | null>(null);
  const [sceneUrls, setSceneUrls] = React.useState<string[]>([]);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isSpeaking, setIsSpeaking] = React.useState<boolean>(false);
  const [isTalking, setIsTalking] = React.useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = React.useState<number>(0);
  const [lastRequest, setLastRequest] = React.useState<
    { prompt: string; mimeType: string; base64: string } | null
  >(null);
  const [shouldAutoGenerate, setShouldAutoGenerate] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const objectUrl = React.useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  async function compressImage(
    sourceFile: File,
    maxSize: number = 1024,
    quality: number = 0.85
  ): Promise<{ blob: Blob; mimeType: string; name: string; base64: string }> {
    // Decode image
    const bitmap = await createImageBitmap(sourceFile);
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.imageSmoothingEnabled = true;
    // imageSmoothingQuality is widely supported; cast to unknown to avoid TS DOM lib variance
    (ctx as unknown as { imageSmoothingQuality?: string }).imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, dstW, dstH);

    const mimeType = "image/jpeg";
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))), mimeType, quality);
    });

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    return { blob, mimeType, name: sourceFile.name.replace(/\.[^.]+$/, ".jpg"), base64 };
  }

  const handleGenerate = React.useCallback(async () => {
    if (!file || !objectUrl) return;
    try {
      setElapsedMs(0);
      setIsGenerating(true);
      setError(null);
      setResultUrl(null);

      const { blob, mimeType, name, base64 } = await compressImage(file);

      const effectivePrompt = ""; // Prompt is now server-side
      setLastRequest({ prompt: effectivePrompt, mimeType, base64 });

      const form = new FormData();
      // No prompt needed; server will decide
      // Rebuild a File from the original to leverage multipart path
      form.append("file", new File([blob], name, { type: mimeType }));
      const res = await fetch("/api/generate", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Generation failed");
      }
      setResultUrl(data.dataUrl as string);
      setResultDescription((data.description as string) || null);
      setSceneUrls(Array.isArray(data.scenes) ? (data.scenes as string[]) : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }, [file, objectUrl]);

  React.useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [objectUrl, audioUrl]);

  const handleSpeak = React.useCallback(async () => {
    try {
      if (!resultDescription) return;
      // If already synthesized and not revoked, re-use and play
      if (audioUrl && audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play().catch(() => undefined);
        setIsTalking(true);
        return;
      }
      setIsSpeaking(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: resultDescription }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "TTS failed");
      }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      // Play
      setTimeout(async () => {
        if (audioRef.current) {
          audioRef.current.src = url;
          await audioRef.current.play().catch(() => undefined);
          setIsTalking(true);
        }
      }, 0);
    } catch (e) {
      console.error("Failed to synthesize speech:", e);
      setError(e instanceof Error ? e.message : "TTS failed");
    } finally {
      setIsSpeaking(false);
    }
  }, [resultDescription, audioUrl]);

  // Simple elapsed timer while generating
  React.useEffect(() => {
    if (!isGenerating) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(id);
  }, [isGenerating]);

  // Auto-trigger generation once the preview (objectUrl) is ready
  React.useEffect(() => {
    if (file && objectUrl && shouldAutoGenerate && !isGenerating) {
      void handleGenerate();
      setShouldAutoGenerate(false);
    }
  }, [file, objectUrl, shouldAutoGenerate, isGenerating, handleGenerate]);

  const onSelect = (f: File | undefined) => {
    if (!f) return;
    const lowerName = f.name.toLowerCase();
    const isPngOrJpeg = lowerName.endsWith(".png") || lowerName.endsWith(".jpeg");
    if (!isPngOrJpeg) {
      setError("Please select a PNG or JPEG image.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
    setResultUrl(null);
    // Server selects random movie and constructs prompt; mark for auto-generate
    setShouldAutoGenerate(true);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    onSelect(f);
  };

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  // removed duplicate handleGenerate definition

  async function handleRegenerate() {
    try {
      const req = lastRequest;
      if (!req) {
        // Fallback: build request from current file
        if (!file || !objectUrl) return;
        const { blob, mimeType, name, base64 } = await compressImage(file);
        setLastRequest({ prompt: "", mimeType, base64 });
        const form2 = new FormData();
        form2.append("file", new File([blob], name, { type: mimeType }));
        const res2 = await fetch("/api/generate", { method: "POST", body: form2 });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2?.error || "Generation failed");
        setResultUrl(data2.dataUrl as string);
        setResultDescription((data2.description as string) || null);
        setSceneUrls(Array.isArray(data2.scenes) ? (data2.scenes as string[]) : []);
        return;
      }

      setIsGenerating(true);
      setError(null);

      const form = new FormData();
      // No prompt; server handles it
      const blob = Uint8Array.from(atob(req.base64), (c) => c.charCodeAt(0));
      form.append("file", new File([blob], "image", { type: req.mimeType }));
      const res = await fetch("/api/generate", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Generation failed");
      }
      setResultUrl(data.dataUrl as string);
      setResultDescription((data.description as string) || null);
      setSceneUrls(Array.isArray(data.scenes) ? (data.scenes as string[]) : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="w-full max-w-5xl space-y-6 pt-14">
      <Card className="max-w-xl mx-auto glass-card">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-lg">Upload image</CardTitle>
          <CardDescription className="text-xs">Drag & drop a PNG or JPEG image here or click to browse.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleBrowse();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={handleDrop}
            className="relative flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 p-2 text-center transition-colors hover:bg-muted/50"
          >
            <UploadSimple className="h-4 w-4 text-muted-foreground" />
            <div className="text-[10px] text-muted-foreground">Drag & drop a PNG or JPEG image here</div>
            <div className="text-[8px] text-muted-foreground">or</div>
            <Button onClick={handleBrowse} variant="secondary" size="sm">
              Browse files
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpeg"
              className="hidden"
              onChange={(e) => onSelect(e.target.files?.[0])}
            />
          </div>
          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          {/**
           * Manual prompt disabled for now. We auto-generate using a random movie prompt.
           *
           * <div className="mt-3 grid gap-2">
           *   <label htmlFor="prompt" className="text-xs font-medium">Prompt</label>
           *   <textarea
           *     id="prompt"
           *     value={prompt}
           *     onChange={(e) => setPrompt(e.target.value)}
           *     placeholder="Describe how you want to modify the image..."
           *     className="min-h-16 w-full rounded-md border bg-background p-2 text-xs"
           *   />
           *   <div className="flex justify-end">
           *     <Button size="sm" onClick={() => handleGenerate()} disabled={!file || isGenerating || !prompt.trim()}>
           *       {isGenerating ? "Generating..." : "Generate with Gemini"}
           *     </Button>
           *   </div>
           * </div>
           */}
        </CardContent>
      </Card>

      {file ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Card className="glass-card">
          <CardHeader className="min-h-[120px]">
            <CardTitle>Preview</CardTitle>
            <CardDescription>Shows the last image you dropped.</CardDescription>
          </CardHeader>
          <CardContent>
            {file && objectUrl ? (
              <motion.div
                key={objectUrl}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex flex-col gap-3"
              >
                <div className="w-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={objectUrl}
                    alt={file.name}
                    className="max-h-[420px] max-w-full rounded-md border object-contain"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              </motion.div>
            ) : (
              <div className="text-sm text-muted-foreground">No image selected.</div>
            )}
          </CardContent>
          </Card>

          <Card className="glass-card flex flex-col max-h-[80vh]">
        <CardHeader className="min-h-[120px]">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Result</CardTitle>
                <CardDescription>Powered by Nano Banana (gemini-2.5-flash-image-preview).</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating || (!lastRequest && !file)}
                  title="Regenerate with previous prompt and image"
                  className="text-white hover:text-white"
                >
                  <ArrowCounterClockwise className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto">
            {isGenerating ? (
              <div className="w-full flex flex-col items-center justify-center py-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <CircleNotch className="h-10 w-10 text-muted-foreground" />
                </motion.div>
                <div className="mt-3 text-xs text-white/70 tabular-nums" aria-live="polite">
                  { (elapsedMs / 1000).toFixed(1) }s
                </div>
              </div>
            ) : resultUrl ? (
              <motion.div
                key={resultUrl}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full grid gap-3"
              >
                <div className="w-full flex items-center justify-center">
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultUrl} alt="Generated" className="max-h-[512px] max-w-full rounded-md border object-contain" />
                    <button
                      aria-label="Download poster"
                      className="absolute bottom-2 right-2 rounded-md border border-white/25 bg-white/15 text-white p-1.5 backdrop-blur-md hover:bg-white/25 hover:border-white/30"
                      onClick={() => {
                        try {
                          const match = resultUrl?.match(/^data:(.*?);base64,/);
                          const mime = match?.[1] || "image/png";
                          const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png";
                          const now = new Date();
                          const yyyy = now.getFullYear();
                          const mm = String(now.getMonth() + 1).padStart(2, "0");
                          const dd = String(now.getDate()).padStart(2, "0");
                          const hh = String(now.getHours()).padStart(2, "0");
                          const mi = String(now.getMinutes()).padStart(2, "0");
                          const ss = String(now.getSeconds()).padStart(2, "0");
                          const stamp = `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;

                          const a = document.createElement("a");
                          a.href = resultUrl!;
                          a.download = `catflix-poster-${stamp}.${ext}`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        } catch {}
                      }}
                    >
                      <DownloadSimple className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {resultDescription && (
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span>Description</span>
                      <Button
                        variant="glass"
                        size="sm"
                        className="text-white hover:text-white"
                        onClick={handleSpeak}
                        disabled={!resultDescription || isSpeaking}
                        title="Listen to description"
                      >
                        {isSpeaking ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          >
                            <ArrowClockwise className="h-4 w-4" />
                          </motion.div>
                        ) : (
                          <UserSound className={`h-4 w-4 ${isTalking ? "text-green-400 animate-pulse" : ""}`} />
                        )}
                      </Button>
                    </div>
                    <div>{resultDescription}</div>
                    <audio
                      ref={audioRef}
                      hidden
                      onPlay={() => setIsTalking(true)}
                      onEnded={() => setIsTalking(false)}
                      onPause={() => setIsTalking(false)}
                      onError={() => setIsTalking(false)}
                    />
                  </div>
                )}
                {sceneUrls.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:[&>div:last-child:nth-child(odd)]:col-span-2">
                    {sceneUrls.slice(0, 3).map((u, i) => (
                      <div key={i} className="w-full flex items-center justify-center">
                        <div className="relative inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Scene ${i + 1}`} className="max-h-[480px] h-auto rounded-md border object-contain" />
                          <button
                            aria-label={`Download scene ${i + 1}`}
                            className="absolute bottom-2 right-2 rounded-md border border-white/25 bg-white/15 text-white p-1.5 backdrop-blur-md hover:bg-white/25 hover:border-white/30"
                            onClick={() => {
                              try {
                                const match = u.match(/^data:(.*?);base64,/);
                                const mime = match?.[1] || "image/png";
                                const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png";
                                const now = new Date();
                                const yyyy = now.getFullYear();
                                const mm = String(now.getMonth() + 1).padStart(2, "0");
                                const dd = String(now.getDate()).padStart(2, "0");
                                const hh = String(now.getHours()).padStart(2, "0");
                                const mi = String(now.getMinutes()).padStart(2, "0");
                                const ss = String(now.getSeconds()).padStart(2, "0");
                                const stamp = `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;

                                const a = document.createElement("a");
                                a.href = u;
                                a.download = `catflix-scene-${i + 1}-${stamp}.${ext}`;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                              } catch {}
                            }}
                          >
                            <DownloadSimple className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    variant="glass"
                    className="text-white hover:text-white"
                    onClick={() => {
                      try {
                        const now = new Date();
                        const yyyy = now.getFullYear();
                        const mm = String(now.getMonth() + 1).padStart(2, "0");
                        const dd = String(now.getDate()).padStart(2, "0");
                        const hh = String(now.getHours()).padStart(2, "0");
                        const mi = String(now.getMinutes()).padStart(2, "0");
                        const ss = String(now.getSeconds()).padStart(2, "0");
                        const stamp = `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;

                        if (resultUrl) {
                          const matchPoster = resultUrl.match(/^data:(.*?);base64,/);
                          const mimePoster = matchPoster?.[1] || "image/png";
                          const extPoster = mimePoster === "image/jpeg" ? "jpg" : mimePoster.split("/")[1] || "png";
                          const aPoster = document.createElement("a");
                          aPoster.href = resultUrl;
                          aPoster.download = `catflix-poster-${stamp}.${extPoster}`;
                          document.body.appendChild(aPoster);
                          aPoster.click();
                          aPoster.remove();
                        }

                        sceneUrls.slice(0, 3).forEach((u, i) => {
                          const match = u.match(/^data:(.*?);base64,/);
                          const mime = match?.[1] || "image/png";
                          const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png";
                          const a = document.createElement("a");
                          a.href = u;
                          a.download = `catflix-scene-${i + 1}-${stamp}.${ext}`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                        });
                      } catch {}
                    }}
                  >
                    Download all
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="text-sm text-muted-foreground">No result yet.</div>
            )}
          </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}



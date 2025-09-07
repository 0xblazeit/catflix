"use client";

import * as React from "react";

import { UploadSimple, CircleNotch, ArrowCounterClockwise } from "@phosphor-icons/react";
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
  const [lastRequest, setLastRequest] = React.useState<
    { prompt: string; mimeType: string; base64: string } | null
  >(null);
  const [shouldAutoGenerate, setShouldAutoGenerate] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const objectUrl = React.useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const handleGenerate = React.useCallback(async () => {
    if (!file || !objectUrl) return;
    try {
      setIsGenerating(true);
      setError(null);
      setResultUrl(null);

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const mimeType = file.type || (file.name.endsWith(".png") ? "image/png" : "image/jpeg");

      const effectivePrompt = ""; // Prompt is now server-side
      setLastRequest({ prompt: effectivePrompt, mimeType, base64 });

      const form = new FormData();
      // No prompt needed; server will decide
      // Rebuild a File from the original to leverage multipart path
      form.append("file", new File([bytes], file.name, { type: mimeType }));
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
    };
  }, [objectUrl]);

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
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const mimeType = file.type || (file.name.endsWith(".png") ? "image/png" : "image/jpeg");
        setLastRequest({ prompt: "", mimeType, base64 });
        return await handleRegenerate();
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
    <div className="w-full max-w-5xl space-y-6">
      <Card className="max-w-xl mx-auto">
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Shows the last image you dropped.</CardDescription>
          </CardHeader>
          <CardContent>
            {file && objectUrl ? (
              <div className="flex flex-col gap-3">
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
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No image selected.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Result</CardTitle>
                <CardDescription>Output generated by Gemini.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating || (!lastRequest && !file)}
                  title="Regenerate with previous prompt and image"
                >
                  <ArrowCounterClockwise className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="w-full flex items-center justify-center py-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <CircleNotch className="h-10 w-10 text-muted-foreground" />
                </motion.div>
              </div>
            ) : resultUrl ? (
              <div className="w-full grid gap-3">
                <div className="w-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resultUrl} alt="Generated" className="max-h-[512px] max-w-full rounded-md border object-contain" />
                </div>
                {resultDescription && (
                  <div className="text-sm text-muted-foreground whitespace-pre-line">
                    {resultDescription}
                  </div>
                )}
                {sceneUrls.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {sceneUrls.slice(0, 3).map((u, i) => (
                      <div key={i} className="w-full flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={`Scene ${i + 1}`} className="max-h-[300px] max-w-full rounded-md border object-contain" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      try {
                        const match = resultUrl.match(/^data:(.*?);base64,/);
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
                        a.href = resultUrl;
                        a.download = `catflix-${stamp}.${ext}`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                      } catch {}
                    }}
                  >
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No result yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



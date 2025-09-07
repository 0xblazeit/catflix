"use client";

import * as React from "react";

import { UploadSimple } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ImageUploader() {
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const objectUrl = React.useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  React.useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

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

  return (
    <div className="w-full max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Upload image</CardTitle>
          <CardDescription>Drag & drop a PNG or JPEG image here or click to browse.</CardDescription>
        </CardHeader>
        <CardContent>
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
            className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/30 p-10 text-center transition-colors hover:bg-muted/50"
          >
            <UploadSimple className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">Drag & drop a PNG or JPEG image here</div>
            <div className="text-xs text-muted-foreground">or</div>
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
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}



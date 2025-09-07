import { NextRequest } from "next/server";

import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type JsonBody = {
  prompt: string;
  mimeType: string;
  base64: string;
};

// Curated themes to encourage diverse outputs
const THEMES: string[] = [
  "psychedelic",
  "romantic comedy",
  "sci-fi",
  "retro",
  "cartoon",
  "film noir",
  "cyberpunk",
  "fantasy",
  "anime",
  "heavy metal",
  "horror",
  "western",
  "medieval",
  "renaissance",
  "baroque",
];

async function readInput(req: NextRequest): Promise<{ prompt: string; mimeType: string; base64: string } | null> {
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const { prompt, mimeType, base64 } = (await req.json()) as JsonBody;
      if (!prompt || !mimeType || !base64) return null;
      return { prompt, mimeType, base64 };
    }
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const prompt = String(form.get("prompt") || "");
      const file = form.get("file");
      if (!prompt || !(file instanceof Blob)) return null;
      const mimeType = file.type || "image/png";
      const buf = Buffer.from(await file.arrayBuffer());
      const base64 = buf.toString("base64");
      return { prompt, mimeType, base64 };
    }
  } catch {
    return null;
  }
  return null;
}

type GeminiInlineImagePart = { inlineData: { mimeType: string; data: string } };
type GeminiTextPart = { text: string };
type GeminiPart = GeminiInlineImagePart | GeminiTextPart | Record<string, unknown>;

async function callGemini(apiKey: string, prompt: string, mimeType: string, base64: string) {
  const ai = new GoogleGenAI({ apiKey });
  // Encourage unique outputs by adding a per-request variation token
  const variationToken = `v:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
  const finalPrompt = `${prompt}\n\nTheme: ${theme}.\nGenerate a distinct variation. Variation token: ${variationToken}`;
  const parts = [{ text: finalPrompt }, { inlineData: { mimeType, data: base64 } }];
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    // The SDK types accept a flexible shape; cast narrowly here to avoid any
    contents: parts as unknown as Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  });
  const partsOut = (response.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
  const imagePart = partsOut.find((p): p is GeminiInlineImagePart =>
    typeof (p as GeminiInlineImagePart).inlineData?.data === "string"
  );
  const textPart = (partsOut.find((p): p is GeminiTextPart => typeof (p as GeminiTextPart).text === "string") as GeminiTextPart | undefined)?.text;
  return { imagePart, textPart };
}

async function describeImage(
  apiKey: string,
  mimeType: string,
  base64: string,
  userHint?: string
): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey });
  const describePrompt =
    (userHint?.trim() || "") +
    (userHint ? "\n\n" : "") +
    "You are a film critic. Based on this movie poster, write a concise 2-3 sentence description summarizing the premise, tone, genre, and distinctive elements. Output plain text only.";
  const parts = [
    { inlineData: { mimeType, data: base64 } },
    { text: describePrompt },
  ];
  const resp = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    contents: parts as unknown as Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
  });
  const outParts = (resp.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
  const text = (outParts.find((p): p is GeminiTextPart => typeof (p as GeminiTextPart).text === "string") as GeminiTextPart | undefined)?.text;
  return text ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await readInput(req);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { prompt, mimeType, base64 } = parsed;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured on server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // First attempt
    let { imagePart, textPart } = await callGemini(apiKey, prompt, mimeType, base64);

    // Retry once with a stronger instruction if only text was returned
    if (!imagePart?.inlineData?.data) {
      const retryPrompt = `${prompt}\n\nReturn an image response only. Do not include text.`;
      const retry = await callGemini(apiKey, retryPrompt, mimeType, base64);
      imagePart = retry.imagePart;
      textPart = retry.textPart || textPart;
    }

    if (!imagePart?.inlineData?.data) {
      return new Response(
        JSON.stringify({ error: "No image returned", details: textPart ?? null }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const outMime = imagePart.inlineData.mimeType || "image/png";
    const generatedBase64 = imagePart.inlineData.data;
    const dataUrl = `data:${outMime};base64,${generatedBase64}`;

    let description: string | null = null;
    try {
      description = await describeImage(apiKey, outMime, generatedBase64);
    } catch {
      description = null;
    }

    return new Response(JSON.stringify({ dataUrl, description }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: "Failed to generate image", details: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



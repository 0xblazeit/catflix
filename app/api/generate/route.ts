import { NextRequest } from "next/server";

import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type GenerateRequestBody = {
  prompt: string;
  mimeType: string; // e.g. "image/png" or "image/jpeg"
  base64: string; // raw base64, no data URL prefix
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, mimeType, base64 } = (await req.json()) as GenerateRequestBody;
    if (!prompt || !mimeType || !base64) {
      return new Response(
        JSON.stringify({ error: "Missing prompt, mimeType or base64" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured on server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build prompt parts: text + inline image data (base64)
    const parts = [
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: parts as any,
    });

    // Extract first image part
    const partsOut = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = partsOut.find((p: any) => p?.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      // If model returned text, include it for debugging purposes
      const textPart = partsOut.find((p: any) => p?.text)?.text;
      return new Response(
        JSON.stringify({ error: "No image returned", details: textPart ?? null }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // The API returns raw base64 without data URL. Wrap it for the client.
    const outMime = imagePart.inlineData.mimeType || "image/png";
    const dataUrl = `data:${outMime};base64,${imagePart.inlineData.data}`;

    return new Response(JSON.stringify({ dataUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Failed to generate image", details: err?.message ?? String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



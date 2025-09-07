import { NextRequest } from "next/server";

import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type JsonBody = {
  prompt?: string;
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

async function readInput(req: NextRequest): Promise<{ mimeType: string; base64: string } | null> {
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const { mimeType, base64 } = (await req.json()) as JsonBody;
      if (!mimeType || !base64) return null;
      return { mimeType, base64 };
    }
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof Blob)) return null;
      const mimeType = file.type || "image/png";
      const buf = Buffer.from(await file.arrayBuffer());
      const base64 = buf.toString("base64");
      return { mimeType, base64 };
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
    "You are an award-winning film producer. Based on this movie poster, craft a captivating 2-3 sentence pitch with a memorable hook that compels audiences to see the film. Highlight the premise, tone, and distinctive elements; avoid spoilers; use vivid, evocative language.";
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

async function generateScenes(
  apiKey: string,
  mimeType: string,
  base64: string
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  const shotVariants = [
    "Scene A (battle/action): an action-driven moment with dynamic motion and energy; different camera angle and location than the poster; dramatic lighting; widescreen 16:9.",
    "Scene B (romance/heart): an intimate, character-driven moment that conveys tenderness or connection; different time-of-day and setting than the poster; cinematic composition; widescreen 16:9.",
    "Scene C (suspense/mystery): a tense or mysterious situation with strong atmosphere; different environment than the poster; evocative lighting; widescreen 16:9.",
  ];

  async function oneScene(variantText: string, token: string): Promise<string | null> {
    const prompt =
      `${variantText} Do NOT recreate a poster layout. No logos, no typography, no credits, no borders. ` +
      `This is an in-universe cinematic still implied by the poster's story. Variation token: ${token}. Return an image response only.`;
    const parts = [{ text: prompt }, { inlineData: { mimeType, data: base64 } }];
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: parts as unknown as Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
    });
    const outParts = (resp.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
    const image = (outParts.find((p): p is GeminiInlineImagePart =>
      typeof (p as GeminiInlineImagePart).inlineData?.data === "string"
    ) as GeminiInlineImagePart | undefined)?.inlineData?.data;
    return image ?? null;
  }

  const tokenA = `sceneA:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tokenB = `sceneB:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tokenC = `sceneC:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const scenePromises = [
    oneScene(shotVariants[0], tokenA),
    oneScene(shotVariants[1], tokenB),
    oneScene(shotVariants[2], tokenC),
  ];
  const sceneResults = await Promise.all(scenePromises);
  const scenes: string[] = sceneResults
    .filter((s): s is string => Boolean(s))
    .map((s) => `data:${mimeType};base64,${s}`);
  return scenes;
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
    const { mimeType, base64 } = parsed;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured on server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // First attempt
    // Build server-side movie prompt
    const MOVIES: string[] = [
      "Titanic",
      "The Fast and the Furious",
      "Brokeback Mountain",
      "Star Wars",
      "The Terminator",
      "the longest yard",
      "Mean girls",
      "The Lord of the Rings",
      "The Matrix",
      "The Dark Knight: Batman",
      "Lion King",
      "The Godfather",
      "Scarface",
      "Toy Story",
      "Forrest Gump",
      "The Green Mile",
      "The Shawshank Redemption",
      "Final Destination",
      "The Sixth Sense",
      "kung fu panda",
      "back to the future",
      "friday night lights",  
      "space jam",
      "avengers infinity war",
      "the wolf of wall street",
      "kill bill",
      "The Exorcist",
      "Rush Hour: jackie chan and chris tucker",
      "Straight Outta Compton",
      "Get Rich or Die Tryin",
      "Guardians of the Galaxy",
      "Saving Private Ryan",
      "Transformers: The Last Knight",
      "The Hangover",
      "dont mess with the zohan",
      "fight club",
      "you got served",
      "the grudge",
      "mission: impossible",
      "The Young Pope"
    ];
    const movie = MOVIES[Math.floor(Math.random() * MOVIES.length)];
    const moviePrompt = `use the cat in the image provided to create a movie poster about the movie, "${movie}" with the provided cat being the focal point. use your creativity to create new and masterful pieces that are award winning quality involving the original movies theme and the cat provided to create a mesmerizing poster about that cat. End with a separate line: with a one liner description of the movie thats found in the poster provided, if none found create a one liner description of the movie based on the movie title. Output plain text only.`;

    let { imagePart, textPart } = await callGemini(apiKey, moviePrompt, mimeType, base64);

    // Retry once with a stronger instruction if only text was returned
    if (!imagePart?.inlineData?.data) {
      const retryPrompt = `${moviePrompt}\n\nReturn an image response only. Do not include text.`;
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
    let scenes: string[] = [];
    const [descRes, scenesRes] = await Promise.allSettled([
      describeImage(apiKey, outMime, generatedBase64),
      generateScenes(apiKey, outMime, generatedBase64),
    ]);
    if (descRes.status === "fulfilled") description = descRes.value; else description = null;
    if (scenesRes.status === "fulfilled") scenes = scenesRes.value; else scenes = [];

    return new Response(JSON.stringify({ dataUrl, description, scenes }), {
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



import { NextRequest } from "next/server";

export const runtime = "nodejs";

const VOICE_IDS = [
  "NOpBlnGInO9m6vDvFkFC",
  "56AoDkrOh6qfVPDXZ7Pt",
  "21m00Tcm4TlvDq8ikWAM",
  "4dZr8J4CBeokyRkTRpoN",
  "2ajXGJNYBR0iNHpS4VZb",
  "ys3XeJJA4ArWMhRpcX1D",
  "qBDvhofpxp92JgXJxDjB"
] as const;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVEN_LABS_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ELEVEN_LABS_API_KEY not configured on server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null) as { text?: string; voiceId?: string } | null;
    const text = (body?.text || "").toString().trim();
    const voiceId = VOICE_IDS[Math.floor(Math.random() * VOICE_IDS.length)];

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Missing 'text'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.7,
          style: 0.0,
          use_speaker_boost: true,
        },
        output_format: "mp3_44100_128",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "TTS request failed", details: errText || res.statusText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: "Failed to synthesize speech", details: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



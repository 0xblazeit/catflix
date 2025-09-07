import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const dir = path.join(process.cwd(), "public", "cat-posters");
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => /\.(png|jpg|jpeg|webp|avif)$/i.test(name));

    // Optionally sort by modified time (newest first)
    const withStats = await Promise.all(
      files.map(async (name) => {
        const stat = await fs.stat(path.join(dir, name));
        return { name, mtimeMs: stat.mtimeMs };
      })
    );
    withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const images = withStats.map((f) => `/cat-posters/${f.name}`);

    return new Response(JSON.stringify({ images }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ images: [], error: err instanceof Error ? err.message : String(err) }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}



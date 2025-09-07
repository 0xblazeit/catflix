## Beau Beau AI — Next‑Gen Image Studio

Beau Beau AI turns your uploaded cat photo into a cinematic movie poster, auto-writes a producer‑style description with a playful “meows” rating, and then generates three distinct scene images from that poster. A built‑in TTS (text-to-speech) button lets you listen to the description.

### AI Features
- Text+Image → Image (Google Gemini `gemini-2.5-flash-image-preview`): generate a poster from the uploaded image and a server‑side prompt (random movie + theme; variation tokens for diversity)
- Text → Text (Google Gemini `gemini-2.5-flash`): produce a concise, punchy producer description with an “X out of 10 meows” rating
- Image → 3 Scene Images (Google Gemini image generation): action/romance/suspense stills derived from the generated poster with retries and variation tokens
- Text → Speech (ElevenLabs TTS): synthesize the description into audio with randomized voices, streamed back as MP3

### UX & Performance
- Drag‑and‑drop image upload with client‑side compression (Canvas) and `.png/.jpeg` validation
- Auto‑trigger generation after preview is ready; visible progress spinner with elapsed timer
- Results card supports per‑image download with timestamped filenames; plus a “Download all” action
- Regenerate button re‑runs the last request to encourage diverse outputs
- Ambient animated poster background (API‑listed images), glassmorphism UI, gradient headline, and responsive layout

### Tech Stack
- Next.js App Router (server routes under `app/api/*`), TypeScript, Tailwind CSS
- Shadcn UI for cards/buttons, Phosphor Icons
- Google Gemini via `@google/genai`, ElevenLabs TTS
- Framer Motion for lightweight animations

### Environment
Create a `.env.local` with:

```
GEMINI_API_KEY=your_key_here
ELEVEN_LABS_API_KEY=your_key_here
```

### Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Project Structure (key files)
- `app/page.tsx`: Hero + uploader
- `components/image-uploader.tsx`: core client logic (upload, compression, API calls, TTS, downloads)
- `app/api/generate/route.ts`: poster + description + 3 scenes generation
- `app/api/tts/route.ts`: ElevenLabs TTS synthesis
- `components/ambient-posters.tsx`: animated background posters

### Notes
- Generation prompts and movie selection happen server‑side for consistency and variety
- Scene generation and description fetch run concurrently to reduce latency

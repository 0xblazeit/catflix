import Image from "next/image";

import { ImageUploader } from "@/components/image-uploader";

export default function Home() {
  return (
    <div className="min-h-screen w-full px-6 md:px-10 pt-28 md:pt-32 lg:pt-36 pb-10">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">Next Gen Image Studio</h1>
        <p className="mt-3 text-sm md:text-base text-white/80">
          Become the <span className="underline decoration-2 underline-offset-4 decoration-white/40 text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-emerald-400 to-cyan-400 bg-[length:200%_100%] animate-gradient-x">star</span> of any movie
        </p>
        <div className="mt-2 md:mt-4 flex justify-center">
          <Image
            src="/three-cats.svg"
            alt=""
            width={1024}
            height={512}
            className="w-full max-w-[240px] md:max-w-[320px] h-auto opacity-90"
            priority
          />
        </div>
      </div>
      <div className="w-full flex items-start justify-center">
        <ImageUploader />
      </div>
    </div>
  );
}

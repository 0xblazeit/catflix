import { ImageUploader } from "@/components/image-uploader";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 md:p-10">
      <ImageUploader />
    </div>
  );
}

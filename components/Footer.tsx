"use client";

import dynamic from "next/dynamic";

const DynamicFooterContent = dynamic(() => import("@/components/FooterContent"));

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 w-full z-50 p-[0.4rem] text-slate-200">
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-black pointer-events-none"></div>
      <div className="relative flex flex-col text-center gap-y-1">
        <DynamicFooterContent />
      </div>
    </footer>
  );
}

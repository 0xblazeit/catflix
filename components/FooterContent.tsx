"use client";

import { GithubLogoIcon } from "@phosphor-icons/react";
import Image from "next/image";

export default function FooterContent() {
  return (
    <div className="flex w-full justify-between items-center px-4">
      <div className="flex items-center">
        <Image src="/catflix.svg" alt="Asogi Logo" width={24} height={24} className="sm:hidden mr-1" />
        <span className="text-xs sm:text-sm font-medium hidden sm:block">BEAU BEAU AI v.BETA</span>
      </div>
      <div className="flex items-center gap-x-2 mx-4">
        <a href="https://github.com/0xblazeit/catflix" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-cyan-300 transition-colors">
          <GithubLogoIcon size={28} weight="duotone" />
        </a>
      </div>
    </div>
  );
}

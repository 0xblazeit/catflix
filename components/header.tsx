"use client";

import * as React from "react";

// External packages
import Image from "next/image";

// Internal modules
import { cn } from "@/lib/utils";

export function Header({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-20",
        "h-20 md:h-24 lg:h-28 px-5 md:px-8",
        "flex items-center",
        "bg-transparent"
      , className)}
    >
      <div className="flex items-center gap-5 md:gap-6">
        <Image
          src="/catflix.svg"
          alt="Catflix logo"
          width={80}
          height={80}
          className="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20"
          priority
        />
        <span className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-wide md:tracking-wider text-white/90">
          Beau Beau Ai
        </span>
      </div>
    </header>
  );
}



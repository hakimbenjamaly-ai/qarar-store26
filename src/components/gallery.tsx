"use client";

import { useState } from "react";

export function Gallery({ images, alt, emptyText }: { images: string[]; alt: string; emptyText: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) return <div className="card grid aspect-square place-items-center text-gray-400">{emptyText}</div>;
  return (
    <div className="space-y-3">
      <div className="card aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={alt} className="h-full w-full object-contain" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((src, k) => (
            <button key={src} type="button" onClick={() => setI(k)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${k === i ? "border-brand-600" : "border-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

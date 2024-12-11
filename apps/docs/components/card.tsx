"use client";
import { cn } from "../lib/utils";

function Card({
  title,
  description,
  src: bgSrc,
  gifSrc,
  backgroundOverlay = true,
  bottomGradientOverlay = false,
}: {
  title?: string;
  description?: string;
  src: string;
  gifSrc?: string;
  backgroundOverlay?: boolean;
  bottomGradientOverlay?: boolean;
}) {
  return (
    <div className="max-w-xs w-full">
      <div
        className={cn(
          "group w-full cursor-pointer overflow-hidden relative card h-96 rounded-md shadow-xl mx-auto flex flex-col justify-end p-4 border border-transparent dark:border-neutral-800",
          "hover:after:content-[''] hover:after:absolute hover:after:inset-0 hover:after:bg-fd-card-foreground dark:hover:after:bg-fd-background hover:after:opacity-50",
          "transition-all duration-500",
          backgroundOverlay ? "bg-opacity-50" : "bg-opacity-100"
        )}
        style={{
          backgroundImage: `url(${bgSrc})`,
          backgroundSize: 'cover',
        }}
        // Set the hover gif background via inline style
        onMouseEnter={(e) => {
          if (gifSrc) {
            (e.currentTarget as HTMLElement).style.backgroundImage = `url(${gifSrc})`;
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundImage = `url(${bgSrc})`;
        }}
      >
        {/* Dark overlay for initial background */}
        {backgroundOverlay && <div className="absolute inset-0 bg-fd-card-foreground dark:bg-fd-background opacity-60 z-0"></div>}

        {/* Bottom gradient overlay */}
        {bottomGradientOverlay && (
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black to-transparent z-0"></div>
        )}

        <div className="text relative z-[1]">
          <h1 className="font-bold text-xl md:text-3xl text-gray-50 relative">
            {title}
          </h1>
          <p className="font-normal text-base text-gray-50 relative mb-4 mt-2">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Card;


"use client";

import Image from 'next/image';
import { useAppearanceSettings, DEFAULT_LOGO_WIDTH, DEFAULT_ICON_WIDTH } from '@/contexts/appearance-settings-context'; // Corrected import
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function Logo({ className, iconOnly = false }: { className?: string, iconOnly?: boolean }) {
  const { logoDataUrl, logoWidth: contextLogoWidth, isLoading } = useAppearanceSettings(); // Corrected hook usage

  if (isLoading) {
    return <Skeleton className={cn("h-8", iconOnly ? "w-8" : "w-32", className)} />;
  }

  const currentWidth = iconOnly ? DEFAULT_ICON_WIDTH : contextLogoWidth;
  // Aspect ratio for default SVG icon. This might need adjustment if custom image is radically different.
  // Default full logo: 125x35 -> 35/125 = 0.28
  // Default icon only: 32x35 -> 35/32 = 1.09375
  const aspectRatio = iconOnly ? (35 / 32) : (35 / 125);
  const height = currentWidth * aspectRatio;


  if (logoDataUrl) {
    return (
      <div className={`flex items-center ${className || ''}`} style={{ width: `${currentWidth}px`, height: `${height}px` }}>
        <Image
          src={logoDataUrl}
          alt="Navael Custom Logo"
          width={currentWidth}
          height={height}
          className="object-contain" // Ensures aspect ratio is maintained within bounds
          priority
        />
      </div>
    );
  }

  // Default SVG Logo
  return (
    <div className={`flex items-center ${className || ''}`} style={{ width: `${currentWidth}px`, height: `${height}px` }}>
      <svg
        className="h-full w-full"
        viewBox={iconOnly ? "0 0 32 35" : "0 0 125 35"} // Adjusted viewBox for iconOnly
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Navael Logo"
        preserveAspectRatio="xMidYMid meet"
      >
        <path d="M0 3V23H10V13H20V3H0Z" fill="hsl(var(--primary))"/>
        <path d="M10 13V33H20V23H30V13H10Z" fill="hsl(var(--primary)/0.7)"/>
        <circle cx={iconOnly ? "16" : "25"} cy={iconOnly ? "17.5" : "5"} r={iconOnly ? "6" : "4"} fill="hsl(var(--accent))"/>

        {!iconOnly && (
          <>
            <text
              x="38"
              y="17.5"
              dominantBaseline="middle"
              textAnchor="start"
              fontFamily="var(--font-headline), Literata, serif"
              fontSize="19"
              fontWeight="bold"
              fill="hsl(var(--primary))"
            >
              NAV
            </text>
            <text
              x="78"
              y="17.5"
              dominantBaseline="middle"
              textAnchor="start"
              fontFamily="var(--font-headline), Literata, serif"
              fontSize="19"
              fontWeight="bold"
              fill="hsl(var(--accent))"
            >
              AEL
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

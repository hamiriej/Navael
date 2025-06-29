
"use client";

import { useAppearanceSettings } from '@/contexts/appearance-settings-context';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function ThemeApplicator({ children }: { children: ReactNode }) {
  const { themeColors, isLoading } = useAppearanceSettings();

  useEffect(() => {
    if (!isLoading && themeColors) {
      const root = document.documentElement;
      if (themeColors.background) root.style.setProperty('--background', themeColors.background);
      if (themeColors.foreground) root.style.setProperty('--foreground', themeColors.foreground);
      if (themeColors.primary) root.style.setProperty('--primary', themeColors.primary);
      if (themeColors.accent) root.style.setProperty('--accent', themeColors.accent);

      // Example derivations (can be made more robust)
      if (themeColors.background) {
        try {
            const bgParts = themeColors.background.split(' ');
            const bgH = bgParts[0];
            const bgS = parseInt(bgParts[1], 10);
            const bgL = parseInt(bgParts[2], 10);
            root.style.setProperty('--muted', `${bgH} ${Math.max(0,bgS-10)}% ${Math.min(100, bgL + (bgL < 50 ? 5 : -5) )}%`);
            root.style.setProperty('--card', `${bgH} ${bgS}% ${Math.min(100,bgL + (bgL < 50 ? 2 : -2) )}%`); 
            root.style.setProperty('--popover', `${bgH} ${bgS}% ${Math.min(100,bgL + (bgL < 50 ? 2 : -2) )}%`);
        } catch (e) { console.error("Error deriving muted/card colors from background", e); }
      }
      if (themeColors.foreground) {
         try {
            const fgParts = themeColors.foreground.split(' ');
            const fgH = fgParts[0];
            const fgS = parseInt(fgParts[1],10);
            const fgL = parseInt(fgParts[2],10);
            root.style.setProperty('--muted-foreground', `${fgH} ${fgS}% ${Math.min(100, fgL + (fgL < 50 ? 15 : -15))}%`);
            root.style.setProperty('--card-foreground', themeColors.foreground);
            root.style.setProperty('--popover-foreground', themeColors.foreground);

         } catch (e) { console.error("Error deriving muted-foreground from foreground", e); }
      }
      if (themeColors.primary) {
         try {
            const pParts = themeColors.primary.split(' ');
            // const pH = pParts[0];
            // const pS = parseInt(pParts[1],10);
            const pL = parseInt(pParts[2],10);
            root.style.setProperty('--primary-foreground', pL > 50 ? '0 0% 10%' : '0 0% 100%'); // Simple contrast logic
            root.style.setProperty('--ring', themeColors.primary);

         } catch (e) { console.error("Error deriving primary-foreground from primary", e); }
      }
       if (themeColors.accent) {
         try {
            // const aParts = themeColors.accent.split(' ');
            // const aH = aParts[0];
            // const aS = parseInt(aParts[1],10);
            const aL = parseInt(themeColors.accent.split(' ')[2],10);
            root.style.setProperty('--accent-foreground', aL > 50 ? '0 0% 10%' : '0 0% 100%');
         } catch (e) { console.error("Error deriving accent-foreground from accent", e); }
      }
    }
  }, [themeColors, isLoading]);

  return <>{children}</>;
}

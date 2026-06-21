import { useEffect, useMemo, useState } from "react";
import type { Lang } from "@/i18n/dict";
import { getSiteContentValues } from "@/integrations/supabase/site-content";

export function useSiteContent<T extends Record<string, string>>(language: Lang, defaults: T) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadContent() {
      try {
        const values = await getSiteContentValues(language);
        if (isMounted) setOverrides(values);
      } catch (error) {
        console.warn(`[Site content] Could not load ${language}`, error);
      }
    }

    void loadContent();

    return () => {
      isMounted = false;
    };
  }, [language]);

  return useMemo(() => ({ ...defaults, ...overrides }), [defaults, overrides]);
}

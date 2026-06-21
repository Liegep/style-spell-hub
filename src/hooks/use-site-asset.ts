import { useEffect, useState } from "react";
import { getSiteAssetUrl, type SiteAssetKey } from "@/integrations/supabase/site-assets";

export function useSiteAssetUrl(key: SiteAssetKey, fallbackUrl: string) {
  const [url, setUrl] = useState<string | null>(() => readCachedAsset(key));

  useEffect(() => {
    let isMounted = true;

    async function loadAsset() {
      const cachedUrl = readCachedAsset(key);
      if (cachedUrl && isMounted) setUrl(cachedUrl);

      try {
        const liveUrl = await getSiteAssetUrl(key);
        if (!isMounted) return;

        if (liveUrl) {
          cacheAsset(key, liveUrl);
          setUrl(liveUrl);
        } else {
          setUrl(fallbackUrl);
        }
      } catch (error) {
        console.warn(`[Site asset] Could not load ${key}`, error);
        if (isMounted) setUrl(fallbackUrl);
      }
    }

    void loadAsset();

    return () => {
      isMounted = false;
    };
  }, [fallbackUrl, key]);

  return url;
}

function cacheKey(key: SiteAssetKey) {
  return `love-potion:site-asset:${key}`;
}

function readCachedAsset(key: SiteAssetKey) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(cacheKey(key));
}

function cacheAsset(key: SiteAssetKey, url: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cacheKey(key), url);
}

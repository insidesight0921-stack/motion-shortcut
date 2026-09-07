import { useEffect, useState } from 'react';

const IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';

let apiPromise: Promise<typeof YT> | null = null;

/**
 * YouTube IFrame Player API 스크립트를 한 번만 로드한다.
 * 스크립트는 로드가 끝나면 window.onYouTubeIframeAPIReady()를 호출한다.
 */
export function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT!);
      };
      if (!document.querySelector(`script[src="${IFRAME_API_SRC}"]`)) {
        const script = document.createElement('script');
        script.src = IFRAME_API_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }
  return apiPromise;
}

export function useYouTubeApi(): typeof YT | null {
  const [api, setApi] = useState<typeof YT | null>(() => window.YT?.Player ? window.YT : null);
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((yt) => {
      if (!cancelled) setApi(yt);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return api;
}

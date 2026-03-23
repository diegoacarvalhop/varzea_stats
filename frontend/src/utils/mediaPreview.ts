/** Host legível para exibição (sem www). */
export function mediaHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'Link';
  }
}

/** Extrai ID de vídeos YouTube (watch, embed, shorts, youtu.be). */
export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }
    if (!host.includes('youtube.com') && !host.includes('youtube-nocookie.com')) {
      return null;
    }
    const v = u.searchParams.get('v');
    if (v) return v;
    let m = u.pathname.match(/\/embed\/([^/?]+)/);
    if (m) return m[1];
    m = u.pathname.match(/\/shorts\/([^/?]+)/);
    if (m) return m[1];
    m = u.pathname.match(/\/live\/([^/?]+)/);
    if (m) return m[1];
  } catch {
    /* ignore */
  }
  return null;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

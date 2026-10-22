import { Avatar, Style } from '@dicebear/core';
import lorelei from '@dicebear/styles/lorelei.json' with { type: 'json' };

// One fixed style for everyone; the seed (assigned at signup) decides the face.
const style = new Style(lorelei);
const BACKGROUNDS = ['#c0aede', '#b6e3f4', '#d1d4f9', '#ffd5dc', '#ffdfbf', '#c4f1e0'];

const cache = new Map<string, string>();
const CACHE_LIMIT = 1000;

export function avatarSvg(seed: string): string {
  let svg = cache.get(seed);
  if (!svg) {
    svg = new Avatar(style, { seed, backgroundColor: BACKGROUNDS, size: 256 }).toString();
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(seed, svg);
  }
  return svg;
}

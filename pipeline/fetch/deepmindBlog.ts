import { fetchBlogRss } from './rssCommon.js';
import type { NormalizedItem } from '../types.js';

const FEED_URL = 'https://deepmind.google/blog/rss.xml';

export async function fetchDeepMindPosts(daysBack = 7): Promise<NormalizedItem[]> {
  return fetchBlogRss(FEED_URL, 'deepmind', daysBack);
}

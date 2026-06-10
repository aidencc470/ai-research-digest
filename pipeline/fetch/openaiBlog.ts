import { fetchBlogRss } from './rssCommon.js';
import type { NormalizedItem } from '../types.js';

const FEED_URL = 'https://openai.com/news/rss.xml';

export async function fetchOpenAiPosts(daysBack = 7): Promise<NormalizedItem[]> {
  return fetchBlogRss(FEED_URL, 'openai', daysBack);
}

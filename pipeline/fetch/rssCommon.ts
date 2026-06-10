import Parser from 'rss-parser';
import type { NormalizedItem, Source } from '../types.js';

const parser = new Parser();

function hashId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return `${Math.abs(hash)}`;
}

export async function fetchBlogRss(
  feedUrl: string,
  source: Source,
  daysBack = 7,
): Promise<NormalizedItem[]> {
  const feed = await parser.parseURL(feedUrl);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const items: NormalizedItem[] = [];

  for (const entry of feed.items ?? []) {
    if (!entry.link || !entry.title) continue;
    const published = entry.isoDate ?? entry.pubDate;
    if (!published) continue;
    const publishedDate = new Date(published);
    if (publishedDate < cutoff) continue;

    items.push({
      id: `${source}-${hashId(entry.link)}`,
      type: 'blog_post',
      source,
      title: entry.title.trim(),
      authors: entry.creator ? [entry.creator] : [],
      summary: (entry.contentSnippet ?? entry.content ?? '').replace(/\s+/g, ' ').trim(),
      url: entry.link,
      publishedDate: publishedDate.toISOString(),
      tags: entry.categories ?? [],
    });
  }

  return items;
}

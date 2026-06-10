import { XMLParser } from 'fast-xml-parser';
import type { NormalizedItem } from '../types.js';

const ARXIV_API_URL = 'https://export.arxiv.org/api/query';

const CATEGORIES = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  author?: { name: string } | { name: string }[];
  link: { '@_href': string; '@_rel': string; '@_type'?: string; '@_title'?: string } | Array<{
    '@_href': string;
    '@_rel': string;
    '@_type'?: string;
    '@_title'?: string;
  }>;
  category?: { '@_term': string } | { '@_term': string }[];
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function arxivIdFromUrl(url: string): string {
  // e.g. http://arxiv.org/abs/2406.12345v2 -> 2406.12345
  const match = url.match(/abs\/([^v]+)/);
  return match ? match[1] : url;
}

export async function fetchArxivPapers(daysBack = 7): Promise<NormalizedItem[]> {
  // Built manually: arXiv's search_query uses literal "+" to mean a space between
  // boolean terms (e.g. "cat:cs.AI+OR+cat:cs.LG"), which URLSearchParams would
  // otherwise percent-encode to "%2B" and break the query.
  const searchQuery = CATEGORIES.map((cat) => `cat:${cat}`).join('+OR+');
  const params = new URLSearchParams({
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    start: '0',
    max_results: '200',
  });
  const url = `${ARXIV_API_URL}?search_query=${searchQuery}&${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API request failed: ${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  const parsed = parser.parse(xml);

  const entries: ArxivEntry[] = toArray(parsed?.feed?.entry);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const items: NormalizedItem[] = [];

  for (const entry of entries) {
    const publishedDate = new Date(entry.published);
    if (publishedDate < cutoff) continue;

    const links = toArray(entry.link);
    const htmlLink = links.find((l) => l['@_rel'] === 'alternate')?.['@_href'] ?? entry.id;
    const pdfLink = links.find((l) => l['@_title'] === 'pdf')?.['@_href'];

    const categories = toArray(entry.category).map((c) => c['@_term']);
    const authors = toArray(entry.author).map((a) => a.name);

    items.push({
      id: arxivIdFromUrl(entry.id),
      type: 'paper',
      source: 'arxiv',
      title: entry.title.replace(/\s+/g, ' ').trim(),
      authors,
      summary: entry.summary.replace(/\s+/g, ' ').trim(),
      url: htmlLink,
      pdfUrl: pdfLink,
      publishedDate: publishedDate.toISOString(),
      tags: categories,
    });
  }

  return items;
}

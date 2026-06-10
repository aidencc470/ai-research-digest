export type ItemType = 'paper' | 'blog_post';

export type Source =
  | 'arxiv'
  | 'semantic_scholar'
  | 'openai'
  | 'deepmind'
  | 'anthropic'
  | 'microsoft_research';

export interface NormalizedItem {
  id: string;
  type: ItemType;
  source: Source;
  title: string;
  authors: string[];
  summary: string;
  url: string;
  pdfUrl?: string;
  publishedDate: string;
  tags: string[];
  citationCount?: number;
  influentialCitationCount?: number;
  tldr?: string;
}

export interface IssueStats {
  totalPapersScanned: number;
  totalPostsScanned: number;
}

export interface Issue {
  slug: string;
  title: string;
  dateRange: { start: string; end: string };
  papersByCategory: Record<string, NormalizedItem[]>;
  labPosts: NormalizedItem[];
  stats: IssueStats;
}

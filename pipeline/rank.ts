import type { NormalizedItem } from './types.js';

const MAX_PAPERS_PER_ISSUE = 20;

// Order matters: more specific categories are matched first, with cs.AI as the catch-all.
const CATEGORY_LABELS: [tag: string, label: string][] = [
  ['cs.CL', 'LLMs & Language'],
  ['cs.CV', 'Computer Vision'],
  ['cs.LG', 'Machine Learning'],
  ['cs.AI', 'AI & Agents'],
];

function categoryLabelFor(tags: string[]): string {
  for (const [tag, label] of CATEGORY_LABELS) {
    if (tags.includes(tag)) return label;
  }
  return 'Other';
}

function byRecencyDesc(a: NormalizedItem, b: NormalizedItem): number {
  return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
}

export function groupPapersByCategory(papers: NormalizedItem[]): Record<string, NormalizedItem[]> {
  const ranked = [...papers].sort(byRecencyDesc).slice(0, MAX_PAPERS_PER_ISSUE);

  const grouped: Record<string, NormalizedItem[]> = {};
  for (const paper of ranked) {
    const label = categoryLabelFor(paper.tags);
    (grouped[label] ??= []).push(paper);
  }

  return grouped;
}

export function rankLabPosts(posts: NormalizedItem[]): NormalizedItem[] {
  return [...posts].sort(byRecencyDesc);
}

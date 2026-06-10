import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchArxivPapers } from './fetch/arxiv.js';
import { fetchOpenAiPosts } from './fetch/openaiBlog.js';
import { fetchDeepMindPosts } from './fetch/deepmindBlog.js';
import { dedupeItems } from './dedupe.js';
import { groupPapersByCategory, rankLabPosts } from './rank.js';
import type { Issue, NormalizedItem } from './types.js';

const DAYS_BACK = 7;
const SEEN_RETENTION_DAYS = 90;

const ROOT = path.resolve(import.meta.dirname, '..');
const SEEN_PATH = path.join(ROOT, 'pipeline', 'state', 'seen.json');
const ISSUES_DIR = path.join(ROOT, 'src', 'content', 'issues');

type SeenMap = Record<string, string>; // id -> ISO date first seen

async function loadSeen(): Promise<SeenMap> {
  try {
    const raw = await readFile(SEEN_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveSeen(seen: SeenMap): Promise<void> {
  const cutoff = Date.now() - SEEN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pruned: SeenMap = {};
  for (const [id, dateStr] of Object.entries(seen)) {
    if (new Date(dateStr).getTime() >= cutoff) {
      pruned[id] = dateStr;
    }
  }
  await mkdir(path.dirname(SEEN_PATH), { recursive: true });
  await writeFile(SEEN_PATH, JSON.stringify(pruned, null, 2) + '\n');
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTitleDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function main() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - DAYS_BACK);

  console.log('Fetching arXiv papers...');
  const papers = await fetchArxivPapers(DAYS_BACK);
  console.log(`  -> ${papers.length} papers found`);

  console.log('Fetching OpenAI blog posts...');
  const openaiPosts = await fetchOpenAiPosts(DAYS_BACK);
  console.log(`  -> ${openaiPosts.length} posts found`);

  console.log('Fetching DeepMind blog posts...');
  const deepmindPosts = await fetchDeepMindPosts(DAYS_BACK);
  console.log(`  -> ${deepmindPosts.length} posts found`);

  const allItems: NormalizedItem[] = dedupeItems([...papers, ...openaiPosts, ...deepmindPosts]);

  const seen = await loadSeen();
  const newItems = allItems.filter((item) => !(item.id in seen));

  const newPapers = newItems.filter((item) => item.type === 'paper');
  const newPosts = newItems.filter((item) => item.type === 'blog_post');

  const papersByCategory = groupPapersByCategory(newPapers);
  const labPosts = rankLabPosts(newPosts);

  const slug = formatDate(now);
  const issue: Issue = {
    slug,
    title: `Weekly AI Digest — ${formatTitleDate(now)}`,
    dateRange: { start: start.toISOString(), end: now.toISOString() },
    papersByCategory,
    labPosts,
    stats: {
      totalPapersScanned: papers.length,
      totalPostsScanned: openaiPosts.length + deepmindPosts.length,
    },
  };

  await mkdir(ISSUES_DIR, { recursive: true });
  const issuePath = path.join(ISSUES_DIR, `${slug}.json`);
  await writeFile(issuePath, JSON.stringify(issue, null, 2) + '\n');
  console.log(`Wrote issue to ${path.relative(ROOT, issuePath)}`);

  const nowIso = now.toISOString();
  for (const item of newItems) {
    seen[item.id] = nowIso;
  }
  await saveSeen(seen);

  const totalPapers = Object.values(papersByCategory).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Issue ${slug}: ${totalPapers} papers, ${labPosts.length} lab posts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const normalizedItemSchema = z.object({
  id: z.string(),
  type: z.enum(['paper', 'blog_post']),
  source: z.enum([
    'arxiv',
    'semantic_scholar',
    'openai',
    'deepmind',
    'anthropic',
    'microsoft_research',
  ]),
  title: z.string(),
  authors: z.array(z.string()),
  summary: z.string(),
  url: z.string(),
  pdfUrl: z.string().optional(),
  publishedDate: z.string(),
  tags: z.array(z.string()),
  citationCount: z.number().optional(),
  influentialCitationCount: z.number().optional(),
  tldr: z.string().optional(),
});

const issues = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/issues' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    dateRange: z.object({ start: z.string(), end: z.string() }),
    papersByCategory: z.record(z.string(), z.array(normalizedItemSchema)),
    labPosts: z.array(normalizedItemSchema),
    stats: z.object({
      totalPapersScanned: z.number(),
      totalPostsScanned: z.number(),
    }),
  }),
});

export const collections = { issues };

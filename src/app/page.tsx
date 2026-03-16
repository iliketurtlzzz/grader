'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const Buddy = dynamic(() => import('./buddy'), { ssr: false });

// ─── Types ───

interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  description: string;
  findings: string[];
}

interface Highlight {
  type: 'positive' | 'warning' | 'critical';
  message: string;
}

interface InlineAnnotation {
  text: string;
  startIndex: number;
  endIndex: number;
  type: 'critical' | 'warning' | 'suggestion';
  category: string;
  issue: string;
  fix: string;
}

interface AnalysisResult {
  overallScore: number;
  categories: CategoryScore[];
  highlights: Highlight[];
  summary: string;
  annotations: InlineAnnotation[];
}

interface GradeRecord {
  id: string;
  fileName: string;
  score: number;
  date: string;
  result: AnalysisResult;
  source: 'document' | 'url';
  url?: string;
  documentText?: string;
}

// ─── Helpers ───

function getScoreColor(score: number): string {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-fair';
  return 'score-poor';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
}

function getScoreHex(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

function getCategoryBarColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  return getScoreHex(pct);
}

function getAnnotationColor(type: string): { bg: string; border: string; text: string } {
  switch (type) {
    case 'critical':
      return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444' };
    case 'warning':
      return { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#eab308' };
    default:
      return { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' };
  }
}

// ─── Educational content for each category ───

const CATEGORY_EDUCATION: Record<string, { whatWeLookFor: string; whyItMatters: string; goodExample: string; badExample: string; tips: string[] }> = {
  'Front-Loading (Ski Ramp)': {
    whatWeLookFor: 'We check if your main topic, key definitions, and conclusions appear in the first 20-30% of your content. LLMs heavily weight the top of the page when deciding what to cite.',
    whyItMatters: '44.2% of all LLM citations come from the first 30% of a page. This pattern (called the "Ski Ramp") is stable across 1.2M verified citations. If your key points are buried at the bottom, LLMs will likely never cite them.',
    goodExample: 'Programmatic SEO is the process of using automation to create large volumes of search-optimized pages. It combines data sources, templates, and keyword research to generate pages at scale.',
    badExample: 'In today\'s ever-evolving digital landscape, businesses are constantly looking for new ways to grow their online presence. One approach that has gained significant traction is...',
    tips: [
      'Define your topic in the first 1-2 paragraphs',
      'State your conclusion or key takeaway early, not at the end',
      'Eliminate long narrative intros and throat-clearing',
      'Put your most entity-rich, definitive content up front',
    ],
  },
  'Definitive Language': {
    whatWeLookFor: 'We scan for direct, factual statements that clearly define concepts. We also flag vague filler phrases and hype language that weaken citation potential.',
    whyItMatters: 'Definitive statements are nearly 2x more likely to be cited by LLMs (36.2% vs 20.2%). LLMs reward direct relationships between concepts because they need clear, extractable facts.',
    goodExample: 'Programmatic SEO is the process of using templates and databases to generate search-optimized pages at scale. It is used by companies like Zillow, TripAdvisor, and Yelp.',
    badExample: 'In today\'s fast-paced world, many businesses are starting to think about maybe exploring what some experts might call a more automated approach to SEO.',
    tips: [
      'Use "X is..." and "X refers to..." patterns',
      'Remove hedging words: "might", "perhaps", "could be", "arguably"',
      'Cut filler phrases like "it goes without saying" or "as we all know"',
      'Replace promotional hype with measured, specific claims',
    ],
  },
  'Question + Answer Structure': {
    whatWeLookFor: 'We check if your headings (especially H2s) are framed as questions, and whether the paragraph immediately following each question heading provides a direct answer.',
    whyItMatters: 'Content with questions is 2x more likely to be cited (18.5% vs 9.5%). 78% of cited questions come from headings. LLMs treat headers like prompts and the following paragraph like the answer.',
    goodExample: 'H2: What Is Programmatic SEO?\nProgrammatic SEO is the practice of generating large numbers of search-optimized web pages using automation, templates, and structured data.',
    badExample: 'H2: Programmatic SEO\nLet\'s dive into this topic and explore what makes it so interesting for marketers today. There are many facets to consider...',
    tips: [
      'Structure H2s as real user queries: "What is X?", "How does X work?"',
      'Immediately answer in the first sentence after the heading',
      'Mirror key entities between the heading and the answer paragraph',
      'Aim for 50%+ of your headings to be question-based',
    ],
  },
  'Entity Richness': {
    whatWeLookFor: 'We measure entity density - the ratio of named entities (brands, tools, frameworks, statistics, proper nouns) to total words. We check for variety across entity types.',
    whyItMatters: 'Cited text has an average entity density of 20.6%, compared to just 5-8% in normal English text. Specific brands, tools, frameworks, and named concepts dramatically increase citation likelihood. Generic advice gets ignored.',
    goodExample: 'Google Search Console, Ahrefs, and Screaming Frog are the three primary tools used in technical SEO audits. According to a 2024 Semrush study, 68% of enterprise sites use at least two of these tools.',
    badExample: 'There are many tools available for doing SEO audits. Using the right tools can help you find issues and improve your site\'s performance in search results.',
    tips: [
      'Name specific tools, brands, and frameworks instead of saying "many tools"',
      'Include statistics and data points with sources',
      'Reference specific people, companies, or industry terms',
      'Replace "best practices" with named, concrete examples',
    ],
  },
  'Balanced Sentiment': {
    whatWeLookFor: 'We measure subjectivity score (target: ~0.47) and scan for hype/promotional language. We also check for balanced perspective with contrasting viewpoints.',
    whyItMatters: 'LLMs prefer an analyst tone: not purely objective, not overly emotional. The ideal is fact + interpretation. Cited text has a balanced subjectivity score around 0.47. Promotional or hype-heavy content gets deprioritized.',
    goodExample: 'React is the most widely-adopted frontend framework, used by 40% of developers according to the 2024 Stack Overflow survey. However, Svelte and Vue offer smaller bundle sizes, which can benefit performance-critical applications.',
    badExample: 'React is the most AMAZING, revolutionary, game-changing framework ever created! It will absolutely skyrocket your development speed and blow your mind!',
    tips: [
      'Combine facts with applied insight (analyst tone)',
      'Remove hype words: "amazing", "revolutionary", "game-changing"',
      'Include balanced perspective: "however", "on the other hand"',
      'Present trade-offs and comparisons, not just praise',
    ],
  },
  'Business-Grade Writing': {
    whatWeLookFor: 'We measure Flesch-Kincaid grade level (target: ~16), average sentence length, paragraph structure, and use of structured lists.',
    whyItMatters: 'Cited text has a Flesch-Kincaid grade of ~16 (business-grade), while non-cited text averages 19.1 (too academic). Clear subject-verb-object structures win. 53% of citations come from mid-paragraph, so paragraphs need substance.',
    goodExample: 'Technical SEO audits should cover three areas: crawlability, indexation, and page speed. Crawlability issues prevent search engines from discovering your content. Use Screaming Frog to identify broken links, redirect chains, and orphan pages.',
    badExample: 'The multifaceted and complex nature of technical search engine optimization necessitates a comprehensive, holistic, and systematically-structured approach to the identification, analysis, and remediation of various technical impediments.',
    tips: [
      'Aim for 12-22 words per sentence (moderate length)',
      'Use clear subject-verb-object sentence structures',
      'Keep paragraphs between 30-80 words with substantive content',
      'Use bullet points and numbered lists for key information',
    ],
  },
  'Technical SEO & Schema': {
    whatWeLookFor: 'We check for JSON-LD schema markup, meta description length (120-160 chars), canonical URL, Open Graph tags, and page title presence.',
    whyItMatters: 'Schema markup helps LLMs classify and trust your content. FAQ, HowTo, and Article schema types are especially valuable. Meta descriptions and OG tags provide additional context for content understanding.',
    goodExample: 'A page with Article schema, FAQ schema for common questions, a 150-character meta description, canonical URL, and complete Open Graph tags (og:title, og:description, og:type, og:image).',
    badExample: 'A page with no structured data, no meta description, missing canonical URL, and no Open Graph tags.',
    tips: [
      'Add JSON-LD Article or BlogPosting schema to every content page',
      'Add FAQ schema for question-answer sections',
      'Write meta descriptions between 120-160 characters',
      'Set canonical URLs and complete Open Graph tags',
    ],
  },
};

// ─── Score Circle ───

function ScoreCircle({ score, size = 180 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--score-bg)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={getScoreHex(score)} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="score-circle" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</span>
        <span className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>{getScoreLabel(score)}</span>
      </div>
    </div>
  );
}

// ─── Mini Score ───

function MiniScore({ score, size = 44 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--score-bg)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={getScoreHex(score)} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className={`absolute text-xs font-bold ${getScoreColor(score)}`}>{score}</span>
    </div>
  );
}

// ─── Theme Toggle ───

function ThemeToggle({ theme, setTheme }: { theme: string; setTheme: (t: string) => void }) {
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-secondary flex items-center gap-2 text-sm" aria-label="Toggle theme">
      {theme === 'dark' ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
          Light
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          Dark
        </>
      )}
    </button>
  );
}

// ─── Back Button ───

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="btn-secondary mb-6 flex items-center gap-2 text-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      {label}
    </button>
  );
}

// ─── Document Recommendations View (inline annotations on the doc) ───

function RecommendationsView({
  result,
  documentText,
  onBack,
  filterCategory,
}: {
  result: AnalysisResult;
  documentText: string;
  onBack: () => void;
  filterCategory?: string;
}) {
  const [expandedAnnotation, setExpandedAnnotation] = useState<number | null>(null);

  const annotations = filterCategory
    ? result.annotations.filter((a) => a.category === filterCategory)
    : result.annotations;

  // Build the document with inline highlights
  const renderAnnotatedDoc = () => {
    if (!documentText || annotations.length === 0) {
      return (
        <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
          {annotations.length === 0
            ? 'No specific inline issues found for this category.'
            : 'No document text available.'}
        </div>
      );
    }

    // Split document into paragraphs for display
    const paragraphs = documentText.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length === 0) {
      // Fallback: split by newlines
      const lines = documentText.split(/\n/).filter((l) => l.trim().length > 0);
      return renderParagraphsWithAnnotations(lines);
    }
    return renderParagraphsWithAnnotations(paragraphs);
  };

  const renderParagraphsWithAnnotations = (paragraphs: string[]) => {
    let runningIndex = 0;

    return paragraphs.map((para, pIdx) => {
      const paraStart = documentText.indexOf(para, runningIndex);
      const paraEnd = paraStart + para.length;
      runningIndex = paraEnd;

      // Find annotations that overlap with this paragraph
      const paraAnnotations = annotations.filter(
        (a) => a.startIndex < paraEnd && a.endIndex > paraStart
      );

      if (paraAnnotations.length === 0) {
        return (
          <p key={pIdx} className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {para}
          </p>
        );
      }

      // Render paragraph with highlighted spans
      const elements: React.ReactNode[] = [];
      let cursor = 0;

      for (const ann of paraAnnotations) {
        const relStart = Math.max(0, ann.startIndex - paraStart);
        const relEnd = Math.min(para.length, ann.endIndex - paraStart);

        // Text before annotation
        if (relStart > cursor) {
          elements.push(
            <span key={`t-${cursor}`} style={{ color: 'var(--text-secondary)' }}>
              {para.substring(cursor, relStart)}
            </span>
          );
        }

        // The annotated text
        const annIdx = annotations.indexOf(ann);
        const colors = getAnnotationColor(ann.type);
        const isExpanded = expandedAnnotation === annIdx;

        elements.push(
          <span key={`a-${annIdx}`} className="relative inline">
            <span
              onClick={() => setExpandedAnnotation(isExpanded ? null : annIdx)}
              className="cursor-pointer rounded px-0.5"
              style={{
                background: colors.bg,
                borderBottom: `2px solid ${colors.border}`,
              }}
            >
              {para.substring(relStart, relEnd)}
            </span>
            {isExpanded && (
              <span
                className="block mt-2 mb-3 p-4 rounded-lg text-sm"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: colors.border }}
                  />
                  <span className="font-semibold text-xs uppercase" style={{ color: colors.text }}>
                    {ann.type === 'critical' ? 'Fix Required' : ann.type === 'warning' ? 'Warning' : 'Suggestion'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {ann.category}
                  </span>
                </span>
                <span className="block mb-2" style={{ color: 'var(--text-primary)' }}>
                  {ann.issue}
                </span>
                <span className="block p-3 rounded" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-xs font-semibold block mb-1" style={{ color: '#22c55e' }}>
                    How to fix:
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{ann.fix}</span>
                </span>
              </span>
            )}
          </span>
        );

        cursor = relEnd;
      }

      // Remaining text after last annotation
      if (cursor < para.length) {
        elements.push(
          <span key={`t-end`} style={{ color: 'var(--text-secondary)' }}>
            {para.substring(cursor)}
          </span>
        );
      }

      return (
        <p key={pIdx} className="mb-4 text-sm leading-relaxed">
          {elements}
        </p>
      );
    });
  };

  // Summary counts
  const criticalCount = annotations.filter((a) => a.type === 'critical').length;
  const warningCount = annotations.filter((a) => a.type === 'warning').length;
  const suggestionCount = annotations.filter((a) => a.type === 'suggestion').length;

  return (
    <div>
      <BackButton onClick={onBack} label={filterCategory ? 'Back to Category' : 'Back to Results'} />

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-bold mb-2">
          {filterCategory ? `${filterCategory} - In Your Document` : 'Document Recommendations'}
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Click any highlighted text to see the issue and how to fix it.
        </p>
        <div className="flex gap-4 text-xs">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#eab308' }} />
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
          {suggestionCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} />
              {suggestionCount} suggestion{suggestionCount > 1 ? 's' : ''}
            </span>
          )}
          {annotations.length === 0 && (
            <span style={{ color: '#22c55e' }}>No issues found</span>
          )}
        </div>
      </div>

      {/* Annotation list (quick jump) */}
      {annotations.length > 0 && (
        <div className="card p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3">All Issues</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {annotations.map((ann, i) => {
              const colors = getAnnotationColor(ann.type);
              return (
                <button
                  key={i}
                  onClick={() => setExpandedAnnotation(expandedAnnotation === i ? null : i)}
                  className="w-full text-left p-3 rounded-lg flex items-start gap-3 text-sm transition-colors"
                  style={{
                    background: expandedAnnotation === i ? colors.bg : 'var(--bg-secondary)',
                    border: expandedAnnotation === i ? `1px solid ${colors.border}` : '1px solid transparent',
                  }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: colors.border }} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      &quot;{ann.text}&quot;
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {ann.issue.substring(0, 80)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Annotated document */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
          YOUR DOCUMENT
        </h3>
        <div className="prose-sm">{renderAnnotatedDoc()}</div>
      </div>
    </div>
  );
}

// ─── Category Detail View (with quotes from the doc) ───

function CategoryDetail({
  category,
  annotations,
  documentText,
  onBack,
  onViewInDoc,
}: {
  category: CategoryScore;
  annotations: InlineAnnotation[];
  documentText: string;
  onBack: () => void;
  onViewInDoc: () => void;
}) {
  const pct = Math.round((category.score / category.maxScore) * 100);
  const categoryAnnotations = annotations.filter((a) => a.category === category.name);
  const education = CATEGORY_EDUCATION[category.name];

  return (
    <div>
      <BackButton onClick={onBack} label="Back to Results" />

      <div className="card p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{category.name}</h2>
            <p style={{ color: 'var(--text-secondary)' }} className="mt-1">{category.description}</p>
          </div>
          <div className="text-right">
            <span className={`text-4xl font-bold ${getScoreColor(pct)}`}>{category.score}</span>
            <span style={{ color: 'var(--text-muted)' }} className="text-lg">/{category.maxScore}</span>
          </div>
        </div>

        <div className="progress-bar mb-8" style={{ height: '12px' }}>
          <div className="progress-fill" style={{ width: `${pct}%`, background: getCategoryBarColor(category.score, category.maxScore) }} />
        </div>

        {/* Educational section */}
        {education && (
          <div className="mb-8 p-5 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-bold uppercase mb-3" style={{ color: 'var(--accent)' }}>What We Look For</h3>
            <p className="text-sm mb-4 leading-relaxed">{education.whatWeLookFor}</p>

            <h4 className="text-sm font-bold uppercase mb-2" style={{ color: 'var(--accent)' }}>Why It Matters</h4>
            <p className="text-sm mb-4 leading-relaxed">{education.whyItMatters}</p>

            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="p-3 rounded-lg" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#22c55e' }}>Good Example</p>
                <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>&quot;{education.goodExample}&quot;</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: '#ef4444' }}>Bad Example</p>
                <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>&quot;{education.badExample}&quot;</p>
              </div>
            </div>

            <h4 className="text-sm font-bold uppercase mt-4 mb-2" style={{ color: 'var(--accent)' }}>Tips</h4>
            <ul className="space-y-1.5">
              {education.tips.map((tip, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span style={{ color: 'var(--accent)' }}>&#8226;</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Findings */}
        <h3 className="text-lg font-semibold mb-4">Your Results</h3>
        <div className="space-y-3 mb-8">
          {category.findings.map((finding, i) => {
            const isPositive = /\b(good|strong|excellent|clean|avoids|balanced|contains|uses)\b/i.test(finding);
            const isNegative = /\b(no |low|only|limited|excessive|too |eliminate|remove|very low|missing)\b/i.test(finding);

            return (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <span className="mt-0.5 flex-shrink-0">
                  {isPositive ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : isNegative ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  )}
                </span>
                <span className="text-sm leading-relaxed">{finding}</span>
              </div>
            );
          })}
        </div>

        {/* Specific quotes from the document */}
        {categoryAnnotations.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mb-4">Found in Your Document</h3>
            <div className="space-y-4 mb-6">
              {categoryAnnotations.map((ann, i) => {
                const colors = getAnnotationColor(ann.type);
                return (
                  <div key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
                    {/* Quote from doc */}
                    <div className="p-4" style={{ background: colors.bg }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: colors.border }} />
                        <span className="text-xs font-semibold uppercase" style={{ color: colors.text }}>
                          {ann.type}
                        </span>
                      </div>
                      <p className="text-sm italic" style={{ color: 'var(--text-primary)' }}>
                        &quot;{ann.text}&quot;
                      </p>
                    </div>
                    {/* Issue + fix */}
                    <div className="p-4" style={{ background: 'var(--bg-card)' }}>
                      <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{ann.issue}</p>
                      <div className="p-3 rounded" style={{ background: 'var(--bg-secondary)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#22c55e' }}>How to fix:</p>
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{ann.fix}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {documentText && (
              <button onClick={onViewInDoc} className="btn-primary text-sm w-full">
                View All Issues in Document
              </button>
            )}
          </>
        )}

        {categoryAnnotations.length === 0 && documentText && (
          <div className="text-center p-6 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No specific inline issues found for this category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Results View ───

function ResultsView({
  result,
  fileName,
  documentText,
  onBack,
  onRegrade,
}: {
  result: AnalysisResult;
  fileName: string;
  documentText: string;
  onBack: () => void;
  onRegrade: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryScore | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recFilterCategory, setRecFilterCategory] = useState<string | undefined>(undefined);

  // Recommendations view (full doc with highlights)
  if (showRecommendations) {
    return (
      <RecommendationsView
        result={result}
        documentText={documentText}
        filterCategory={recFilterCategory}
        onBack={() => {
          if (recFilterCategory) {
            setRecFilterCategory(undefined);
            setShowRecommendations(false);
            // Go back to category detail
          } else {
            setShowRecommendations(false);
          }
        }}
      />
    );
  }

  // Category detail view
  if (selectedCategory) {
    return (
      <CategoryDetail
        category={selectedCategory}
        annotations={result.annotations || []}
        documentText={documentText}
        onBack={() => setSelectedCategory(null)}
        onViewInDoc={() => {
          setRecFilterCategory(selectedCategory.name);
          setShowRecommendations(true);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </button>
        <button onClick={onRegrade} className="btn-primary text-sm">Re-Grade Updated Copy</button>
      </div>

      {/* Score header */}
      <div className="card p-8 text-center mb-8">
        <p style={{ color: 'var(--text-secondary)' }} className="mb-2 text-sm">{fileName}</p>
        <ScoreCircle score={result.overallScore} />
        <p style={{ color: 'var(--text-secondary)' }} className="mt-4 max-w-xl mx-auto text-sm leading-relaxed">{result.summary}</p>
      </div>

      {/* See Recommendations button */}
      {documentText && result.annotations && result.annotations.length > 0 && (
        <button
          onClick={() => {
            setRecFilterCategory(undefined);
            setShowRecommendations(true);
          }}
          className="w-full mb-8 p-4 rounded-xl flex items-center justify-between group"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--accent)',
          }}
        >
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <div className="text-left">
              <p className="font-semibold text-sm">See Recommendations in Document</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {result.annotations.length} issues highlighted directly in your copy
              </p>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" className="group-hover:translate-x-1 transition-transform">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Highlights */}
      {result.highlights.length > 0 && (
        <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {result.highlights.map((h, i) => (
            <div key={i} className="card p-4 flex items-start gap-3" style={{ borderLeftWidth: '3px', borderLeftColor: h.type === 'positive' ? '#22c55e' : h.type === 'warning' ? '#eab308' : '#ef4444' }}>
              <span className="text-sm">{h.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Category scores */}
      <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
      <div className="space-y-3">
        {result.categories.map((cat) => {
          const pct = Math.round((cat.score / cat.maxScore) * 100);
          const catAnnotations = (result.annotations || []).filter((a) => a.category === cat.name);
          return (
            <button key={cat.name} onClick={() => setSelectedCategory(cat)} className="card p-5 w-full text-left flex items-center gap-5 group">
              <MiniScore score={pct} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{cat.name}</span>
                  <span className="flex items-center gap-2">
                    {catAnnotations.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                        {catAnnotations.length} issue{catAnnotations.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }} className="text-sm">{cat.score}/{cat.maxScore}</span>
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: getCategoryBarColor(cat.score, cat.maxScore) }} />
                </div>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-2 truncate">{cat.description}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" className="flex-shrink-0 group-hover:translate-x-1 transition-transform"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── History Item with Rename ───

function HistoryItem({
  record,
  onOpen,
  onDelete,
  onRename,
}: {
  record: GradeRecord;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(record.fileName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div className="history-item flex items-center gap-4">
      <button className="flex-1 flex items-center gap-4 text-left" onClick={onOpen}>
        <MiniScore score={record.score} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-sm font-medium px-2 py-1 rounded"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', color: 'var(--text-primary)', outline: 'none' }}
            />
          ) : (
            <p className="font-medium text-sm truncate">{record.fileName}</p>
          )}
          <p style={{ color: 'var(--text-muted)' }} className="text-xs">{record.date} &middot; {record.source === 'url' ? 'URL' : 'Document'}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      {/* Rename button */}
      <button
        onClick={(e) => { e.stopPropagation(); setEditName(record.fileName); setEditing(true); }}
        className="flex-shrink-0 p-1 rounded hover:bg-blue-500/10"
        title="Rename"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      {/* Delete button */}
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="flex-shrink-0 p-1 rounded hover:bg-red-500/10" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
}

// ─── Main App ───

export default function Home() {
  const [theme, setTheme] = useState('dark');
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [view, setView] = useState<'home' | 'results'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentDocText, setCurrentDocText] = useState('');
  const [history, setHistory] = useState<GradeRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('stopslop-theme');
    if (savedTheme) setTheme(savedTheme);
    const savedHistory = localStorage.getItem('stopslop-history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stopslop-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('stopslop-history', JSON.stringify(history));
  }, [history]);

  const saveToHistory = useCallback(
    (result: AnalysisResult, fileName: string, source: 'document' | 'url', docText: string, urlValue?: string) => {
      const record: GradeRecord = {
        id: Date.now().toString(),
        fileName,
        score: result.overallScore,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        result,
        source,
        url: urlValue,
        documentText: docText,
      };
      setHistory((prev) => [record, ...prev]);
    },
    []
  );

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/analyze-document', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Analysis failed'); return; }

      setCurrentResult(data.result);
      setCurrentFileName(data.fileName);
      setCurrentDocText(data.documentText || '');
      saveToHistory(data.result, data.fileName, 'document', data.documentText || '');
      setView('results');
    } catch {
      setError('Failed to connect. Make sure the app is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlAnalyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/analyze-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Analysis failed'); return; }

      setCurrentResult(data.result);
      setCurrentFileName(data.url || url);
      setCurrentDocText(data.documentText || '');
      saveToHistory(data.result, data.url || url, 'url', data.documentText || '', data.url);
      setView('results');
    } catch {
      setError('Failed to connect. Make sure the app is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); };

  const openHistoryItem = (record: GradeRecord) => {
    setCurrentResult(record.result);
    setCurrentFileName(record.fileName);
    setCurrentDocText(record.documentText || '');
    setView('results');
  };

  const deleteHistoryItem = (id: string) => { setHistory((prev) => prev.filter((r) => r.id !== id)); };
  const clearHistory = () => { setHistory([]); };
  const renameHistoryItem = (id: string, newName: string) => {
    setHistory((prev) => prev.map((r) => r.id === id ? { ...r, fileName: newName } : r));
  };

  // ─── Results view ───
  if (view === 'results' && currentResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black tracking-tight">STOPSLOP</h1>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <ResultsView
          result={currentResult}
          fileName={currentFileName}
          documentText={currentDocText}
          onBack={() => setView('home')}
          onRegrade={() => { setView('home'); setCurrentResult(null); }}
        />
      </div>
    );
  }

  // ─── Home view ───
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 relative" style={{ minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-2">
        <div />
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>

      <div className="text-center mb-4">
        <h1 className="text-6xl font-black tracking-tighter mb-3">STOPSLOP</h1>
        <p style={{ color: 'var(--text-secondary)' }} className="text-lg max-w-md mx-auto">
          Grade your content for LLM citation readiness. Audit copy before it goes live.
        </p>
      </div>

      {/* Buddy the 8-bit dog */}
      <Buddy theme={theme} />

      <div className="flex gap-2 p-1 rounded-lg mb-6 mx-auto w-fit" style={{ background: 'var(--bg-secondary)' }}>
        <button className={`tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>Upload Document</button>
        <button className={`tab ${tab === 'url' ? 'active' : ''}`} onClick={() => setTab('url')}>Analyze URL</button>
      </div>

      {tab === 'upload' ? (
        <div className={`drop-zone rounded-xl p-12 text-center cursor-pointer ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".docx,.doc,.html,.htm,.txt,.md" onChange={handleFileSelect} className="hidden" />
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" className="mx-auto mb-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="font-semibold mb-1">{loading ? 'Analyzing...' : 'Drop your file here or click to upload'}</p>
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">Supports .docx, .html, .txt, .md</p>
        </div>
      ) : (
        <div className="card p-6">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Page URL</label>
          <div className="flex gap-3">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/your-page"
              className="flex-1 px-4 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlAnalyze(); }}
            />
            <button onClick={handleUrlAnalyze} disabled={loading || !url.trim()} className="btn-primary text-sm whitespace-nowrap">
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-2">Also checks schema markup, meta tags, and Open Graph data</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 rounded-lg text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 text-center">
          <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-secondary)' }} className="mt-3 text-sm">Analyzing content against LLM citation criteria...</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Past Grades</h2>
            <button onClick={clearHistory} className="text-xs" style={{ color: 'var(--text-muted)' }}>Clear All</button>
          </div>
          <div className="space-y-2">
            {history.map((record) => (
              <HistoryItem
                key={record.id}
                record={record}
                onOpen={() => openHistoryItem(record)}
                onDelete={() => deleteHistoryItem(record.id)}
                onRename={(name) => renameHistoryItem(record.id, name)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-16 text-center">
        <p style={{ color: 'var(--text-muted)' }} className="text-xs">Grading criteria based on analysis of 1.2M verified ChatGPT citations (Growth Memo / Gauge)</p>
      </div>
    </div>
  );
}

// Core LLM Citation Grading Engine
// Based on Growth Memo / Gauge analysis of 1.2M verified ChatGPT citations

export interface InlineAnnotation {
  text: string;
  startIndex: number;
  endIndex: number;
  type: 'critical' | 'warning' | 'suggestion';
  category: string;
  issue: string;
  fix: string;
}

export interface AnalysisResult {
  overallScore: number;
  categories: CategoryScore[];
  highlights: Highlight[];
  summary: string;
  annotations: InlineAnnotation[];
}

export interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  description: string;
  findings: string[];
}

export interface Highlight {
  type: 'positive' | 'warning' | 'critical';
  message: string;
}

export interface ParsedContent {
  title: string;
  text: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  html?: string;
  meta?: {
    description?: string;
    schema?: string[];
    canonical?: string;
    ogTags?: Record<string, string>;
  };
}

// ─── Readability helpers ───

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return (
    0.39 * (words.length / sentences.length) +
    11.8 * (totalSyllables / words.length) -
    15.59
  );
}

// ─── Entity detection ───

function extractEntities(text: string): string[] {
  const entities: Set<string> = new Set();

  // Capitalized multi-word phrases (proper nouns)
  const properNouns = text.match(
    /(?:^|[.!?]\s+)(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gm
  );
  if (properNouns) properNouns.forEach((e) => entities.add(e.trim()));

  // Single capitalized words not at sentence start (mid-sentence proper nouns)
  const midSentenceCapitals = text.match(
    /(?<=[a-z,;:]\s)[A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})*/g
  );
  if (midSentenceCapitals)
    midSentenceCapitals.forEach((e) => entities.add(e.trim()));

  // Abbreviations/acronyms (2+ uppercase letters)
  const acronyms = text.match(/\b[A-Z]{2,}\b/g);
  if (acronyms) acronyms.forEach((e) => entities.add(e));

  // Numbers with context (stats, percentages, years)
  const stats = text.match(/\d+(?:\.\d+)?%/g);
  if (stats) stats.forEach((e) => entities.add(e));

  // Quoted terms
  const quoted = text.match(/[""]([^""]+)[""\u201D]/g);
  if (quoted) quoted.forEach((e) => entities.add(e.replace(/["""\u201D]/g, '')));

  return Array.from(entities);
}

function entityDensity(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 0;
  const entities = extractEntities(text);
  const entityWordCount = entities.reduce(
    (sum, e) => sum + e.split(/\s+/).length,
    0
  );
  return entityWordCount / words.length;
}

// ─── Sentiment / subjectivity ───

const SUBJECTIVE_MARKERS = [
  'I think',
  'I believe',
  'in my opinion',
  'arguably',
  'probably',
  'seems',
  'might',
  'could be',
  'perhaps',
  'likely',
  'possibly',
  'generally',
  'typically',
  'usually',
  'often',
  'tend to',
  'appears to',
  'suggests',
];

const HYPE_WORDS = [
  'amazing',
  'incredible',
  'revolutionary',
  'game-changing',
  'groundbreaking',
  'mind-blowing',
  'unbelievable',
  'insane',
  'crazy',
  'awesome',
  'epic',
  'stunning',
  'breathtaking',
  'ultimate',
  'best ever',
  'unprecedented',
  'jaw-dropping',
  'killer',
  'must-have',
  'skyrocket',
];

const VAGUE_OPENERS = [
  "in today's fast-paced world",
  "in today's digital age",
  "it's no secret that",
  'as we all know',
  'have you ever wondered',
  'when it comes to',
  'at the end of the day',
  'it goes without saying',
  'needless to say',
  'the fact of the matter is',
  'in the world of',
  'in this day and age',
  'now more than ever',
  'like never before',
];

function subjectivityScore(text: string): number {
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).length;
  if (words === 0) return 0;

  let subjectiveCount = 0;
  SUBJECTIVE_MARKERS.forEach((marker) => {
    const regex = new RegExp(marker.toLowerCase(), 'gi');
    const matches = lower.match(regex);
    if (matches) subjectiveCount += matches.length;
  });

  // Normalize to 0-1 scale
  return Math.min(subjectiveCount / (words / 50), 1);
}

function countHypeWords(text: string): number {
  const lower = text.toLowerCase();
  return HYPE_WORDS.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = lower.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function countVagueOpeners(text: string): number {
  const lower = text.toLowerCase();
  return VAGUE_OPENERS.reduce((count, opener) => {
    return count + (lower.includes(opener) ? 1 : 0);
  }, 0);
}

// ─── Definitive language detection ───

const DEFINITIVE_PATTERNS = [
  /\b\w+\s+is\s+(?:the\s+)?(?:process|practice|method|technique|strategy|approach|way|system|framework|tool)\s+of\b/gi,
  /\b\w+\s+(?:is|are)\s+defined\s+as\b/gi,
  /\b\w+\s+refers\s+to\b/gi,
  /\b\w+\s+(?:is|are)\s+a\s+(?:type|form|kind|category)\s+of\b/gi,
  /\b(?:there\s+are\s+\d+|the\s+\d+\s+(?:main|key|primary|top))\b/gi,
  /\b\w+\s+(?:is|are)\s+(?:used|designed|built|created|made)\s+(?:to|for)\b/gi,
  /\b(?:according\s+to|research\s+shows|data\s+shows|studies\s+show|evidence\s+suggests)\b/gi,
  /\b\w+\s+(?:is|are)\s+(?:the\s+)?(?:most|best|primary|main|key|leading|largest|fastest)\b/gi,
];

function countDefinitiveStatements(text: string): number {
  return DEFINITIVE_PATTERNS.reduce((count, pattern) => {
    const matches = text.match(pattern);
    return count + (matches ? matches.length : 0);
  }, 0);
}

// ─── Main scoring functions ───

function scoreFrontLoading(content: ParsedContent): CategoryScore {
  const findings: string[] = [];
  let score = 0;
  const maxScore = 20;

  const paragraphs = content.paragraphs;
  if (paragraphs.length === 0) {
    findings.push('No paragraphs detected.');
    return { name: 'Front-Loading (Ski Ramp)', score: 0, maxScore, description: 'Topic clarity in the first 20-30% of the page', findings };
  }

  const totalLength = content.text.length;
  const first30Percent = Math.floor(totalLength * 0.3);
  const firstSection = content.text.substring(0, first30Percent);

  // Check if title/topic is defined early
  const firstParagraph = paragraphs[0] || '';
  const firstTwoParagraphs = paragraphs.slice(0, 2).join(' ');

  // Check for definitive statements in first 2 paragraphs
  const earlyDefinitions = countDefinitiveStatements(firstTwoParagraphs);
  if (earlyDefinitions > 0) {
    score += 8;
    findings.push(`Topic is defined with ${earlyDefinitions} definitive statement(s) in the opening paragraphs.`);
  } else {
    findings.push('No clear topic definition found in the first 1-2 paragraphs. Define your topic early.');
  }

  // Check for vague openers
  const vagueCount = countVagueOpeners(firstParagraph);
  if (vagueCount > 0) {
    score -= 4;
    findings.push('Opening uses vague/generic language. Eliminate intros like "In today\'s fast-paced world..."');
  } else {
    score += 4;
    findings.push('Opening avoids generic filler language.');
  }

  // Check entity density in first 30%
  const earlyEntityDensity = entityDensity(firstSection);
  if (earlyEntityDensity >= 0.15) {
    score += 5;
    findings.push(`Strong entity density (${(earlyEntityDensity * 100).toFixed(1)}%) in the first 30% of content.`);
  } else if (earlyEntityDensity >= 0.08) {
    score += 3;
    findings.push(`Moderate entity density (${(earlyEntityDensity * 100).toFixed(1)}%) in the first 30%. Aim for 15%+.`);
  } else {
    findings.push(`Low entity density (${(earlyEntityDensity * 100).toFixed(1)}%) in the first 30%. Add specific names, tools, brands.`);
  }

  // Check if conclusion/key takeaway appears early
  const conclusionPatterns = /\b(?:key takeaway|in short|the answer is|the result is|conclusion|bottom line|tl;dr|summary)\b/i;
  if (conclusionPatterns.test(firstSection)) {
    score += 3;
    findings.push('Key conclusion or takeaway appears early in the content.');
  } else {
    score += 1;
    findings.push('Consider stating the conclusion or key takeaway earlier.');
  }

  return {
    name: 'Front-Loading (Ski Ramp)',
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    description: '44.2% of LLM citations come from the first 30% of a page. Front-load your key points.',
    findings,
  };
}

function scoreDefinitiveLanguage(content: ParsedContent): CategoryScore {
  const findings: string[] = [];
  let score = 0;
  const maxScore = 15;

  const definitiveCount = countDefinitiveStatements(content.text);
  const sentences = content.text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const totalSentences = sentences.length;

  if (totalSentences === 0) {
    return { name: 'Definitive Language', score: 0, maxScore, description: 'Use of clear, direct statements', findings: ['No sentences detected.'] };
  }

  const definitiveRatio = definitiveCount / totalSentences;

  if (definitiveRatio >= 0.1) {
    score += 8;
    findings.push(`Strong definitive language: ${definitiveCount} definitive statements found (${(definitiveRatio * 100).toFixed(1)}% of sentences).`);
  } else if (definitiveRatio >= 0.05) {
    score += 5;
    findings.push(`Moderate definitive language: ${definitiveCount} definitive statements. Add more "X is the process of..." style definitions.`);
  } else {
    score += 2;
    findings.push(`Low definitive language: only ${definitiveCount} definitive statements. LLMs cite definitive text nearly 2x more.`);
  }

  // Check for vague language throughout
  const vagueCount = countVagueOpeners(content.text);
  if (vagueCount === 0) {
    score += 4;
    findings.push('No vague filler phrases detected.');
  } else {
    score += Math.max(0, 4 - vagueCount);
    findings.push(`Found ${vagueCount} vague/filler phrase(s). Remove these for stronger citations.`);
  }

  // Check for hype words
  const hypeCount = countHypeWords(content.text);
  if (hypeCount === 0) {
    score += 3;
    findings.push('No hype language detected. Clean, professional tone.');
  } else if (hypeCount <= 2) {
    score += 2;
    findings.push(`Minor hype language (${hypeCount} instance(s)). Consider removing.`);
  } else {
    findings.push(`${hypeCount} hype words detected. LLMs prefer factual, analyst-style writing over promotional language.`);
  }

  return {
    name: 'Definitive Language',
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    description: 'Definitive statements are nearly 2x more likely to be cited than vague language.',
    findings,
  };
}

function scoreQuestionAnswerStructure(content: ParsedContent): CategoryScore {
  const findings: string[] = [];
  let score = 0;
  const maxScore = 15;

  const headings = content.headings;

  if (headings.length === 0) {
    findings.push('No headings detected. Use H2 headings structured as questions.');
    return { name: 'Question + Answer Structure', score: 0, maxScore, description: 'Headers as questions with direct answers', findings };
  }

  // Count question headings
  const questionHeadings = headings.filter((h) => h.text.includes('?') || /^(?:what|how|why|when|where|who|which|can|do|does|is|are|should|will)\b/i.test(h.text.trim()));
  const questionRatio = questionHeadings.length / headings.length;

  if (questionRatio >= 0.5) {
    score += 7;
    findings.push(`${questionHeadings.length} of ${headings.length} headings are question-based. Content with questions gets 2x more citations.`);
  } else if (questionRatio >= 0.25) {
    score += 4;
    findings.push(`${questionHeadings.length} of ${headings.length} headings are question-based. Aim for 50%+ question headers.`);
  } else {
    score += 1;
    findings.push(`Only ${questionHeadings.length} of ${headings.length} headings are questions. 78% of cited questions come from headings.`);
  }

  // Check if paragraphs following headings provide direct answers
  let directAnswers = 0;
  for (const heading of questionHeadings) {
    const headingIndex = content.text.indexOf(heading.text);
    if (headingIndex === -1) continue;
    const afterHeading = content.text.substring(headingIndex + heading.text.length, headingIndex + heading.text.length + 300);
    const firstSentence = afterHeading.split(/[.!?]/)[0] || '';
    // Check if it contains a direct definition or answer pattern
    if (/\b(?:is|are|refers to|means|involves|consists of|includes|was|were)\b/i.test(firstSentence)) {
      directAnswers++;
    }
  }

  if (questionHeadings.length > 0) {
    const answerRatio = directAnswers / questionHeadings.length;
    if (answerRatio >= 0.5) {
      score += 5;
      findings.push(`${directAnswers} of ${questionHeadings.length} question headings have direct answers in the following paragraph.`);
    } else {
      score += 2;
      findings.push('Some question headings lack immediate direct answers. Follow "What is X?" with "X is..."');
    }
  }

  // Check heading hierarchy
  const h2Count = headings.filter((h) => h.level === 2).length;
  if (h2Count >= 3) {
    score += 3;
    findings.push(`Good heading structure with ${h2Count} H2 sections.`);
  } else if (h2Count >= 1) {
    score += 1;
    findings.push('Limited H2 structure. Add more H2 sections to break content into scannable blocks.');
  } else {
    findings.push('No H2 headings detected. LLMs treat headers like prompts. Add H2 sections.');
  }

  return {
    name: 'Question + Answer Structure',
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    description: 'Content with questions is 2x more likely to be cited. 78% of cited questions come from headings.',
    findings,
  };
}

function scoreEntityRichness(content: ParsedContent): CategoryScore {
  const findings: string[] = [];
  let score = 0;
  const maxScore = 20;

  const density = entityDensity(content.text);
  const entities = extractEntities(content.text);

  // Target: 20.6% entity density (cited text average)
  // Normal text: 5-8%
  if (density >= 0.18) {
    score += 12;
    findings.push(`Excellent entity density: ${(density * 100).toFixed(1)}% (target: 20.6%, average text: 5-8%).`);
  } else if (density >= 0.12) {
    score += 8;
    findings.push(`Good entity density: ${(density * 100).toFixed(1)}%. Push toward 20%+ for maximum citation potential.`);
  } else if (density >= 0.06) {
    score += 4;
    findings.push(`Below-average entity density: ${(density * 100).toFixed(1)}%. Cited text averages 20.6%. Add named tools, brands, frameworks.`);
  } else {
    findings.push(`Very low entity density: ${(density * 100).toFixed(1)}%. Generic advice loses. Name specific entities.`);
  }

  // Check variety of entity types
  const hasStats = entities.some((e) => /\d+%/.test(e));
  const hasProperNouns = entities.some((e) => /^[A-Z][a-z]/.test(e));
  const hasAcronyms = entities.some((e) => /^[A-Z]{2,}$/.test(e));

  let varietyScore = 0;
  if (hasStats) { varietyScore += 2; findings.push('Contains statistics/data points.'); }
  else { findings.push('Add statistics or data points to increase citation likelihood.'); }
  if (hasProperNouns) { varietyScore += 2; findings.push('Contains named entities (brands, tools, people).'); }
  else { findings.push('Add named brands, tools, or frameworks.'); }
  if (hasAcronyms) { varietyScore += 1; findings.push('Contains industry acronyms/abbreviations.'); }

  score += varietyScore;

  // Entity count
  if (entities.length >= 15) {
    score += 3;
    findings.push(`${entities.length} unique entities detected.`);
  } else if (entities.length >= 8) {
    score += 2;
    findings.push(`${entities.length} unique entities detected. Adding more will improve citation chances.`);
  } else {
    score += 1;
    findings.push(`Only ${entities.length} entities detected. Replace generic language with specific examples.`);
  }

  return {
    name: 'Entity Richness',
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    description: 'Cited text has 20.6% entity density vs. 5-8% for normal text. Specific beats generic.',
    findings,
  };
}

function scoreBalancedSentiment(content: ParsedContent): CategoryScore {
  const findings: string[] = [];
  let score = 0;
  const maxScore = 15;

  const subjectivity = subjectivityScore(content.text);
  const hypeCount = countHypeWords(content.text);
  const words = content.text.split(/\s+/).length;

  // Target subjectivity: ~0.47 (balanced, analyst tone)
  // Too low = purely objective, too high = too opinionated
  const subjectivityDiff = Math.abs(subjectivity - 0.47);

  if (subjectivityDiff <= 0.15) {
    score += 7;
    findings.push(`Balanced subjectivity score: ${subjectivity.toFixed(2)} (target: ~0.47). Good analyst tone.`);
  } else if (subjectivityDiff <= 0.3) {
    score += 4;
    findings.push(`Subjectivity score: ${subjectivity.toFixed(2)}. ${subjectivity < 0.47 ? 'Add more interpretation and insight alongside facts.' : 'Reduce opinion-heavy language. Aim for fact + interpretation.'}`);
  } else {
    score += 1;
    findings.push(`Subjectivity score: ${subjectivity.toFixed(2)} is far from the ideal ~0.47. ${subjectivity < 0.2 ? 'Too dry/objective. LLMs prefer fact + applied insight.' : 'Too subjective. Ground claims in data and specifics.'}`);
  }

  // Hype word density
  const hypePerThousand = (hypeCount / words) * 1000;
  if (hypePerThousand === 0) {
    score += 5;
    findings.push('No promotional/hype language. Clean analyst tone.');
  } else if (hypePerThousand < 2) {
    score += 3;
    findings.push(`Minor hype language detected (${hypeCount} instances). LLMs prefer measured analysis.`);
  } else {
    score += 1;
    findings.push(`Excessive hype language (${hypeCount} instances). Remove words like "amazing", "revolutionary", "game-changing".`);
  }

  // Check for balanced perspective (pros/cons, comparisons)
  const balanceIndicators = /\b(?:however|on the other hand|alternatively|in contrast|while|although|compared to|versus|pros and cons|advantages and disadvantages|trade-?offs?)\b/gi;
  const balanceMatches = content.text.match(balanceIndicators);
  if (balanceMatches && balanceMatches.length >= 2) {
    score += 3;
    findings.push('Content shows balanced perspective with contrasting viewpoints.');
  } else if (balanceMatches && balanceMatches.length >= 1) {
    score += 2;
    findings.push('Some balanced perspective detected. Consider adding more nuance.');
  } else {
    score += 1;
    findings.push('Limited balanced perspective. Adding "however" or comparison points improves citation trust.');
  }

  return {
    name: 'Balanced Sentiment',
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    description: 'LLMs prefer analyst tone: fact + interpretation. Not purely objective, not overly emotional.',
    findings,
  };
}

function scoreBusinessGradeWriting(content: ParsedContent): CategoryScore {
  const findings: string[] = [];
  let score = 0;
  const maxScore = 15;

  // Flesch-Kincaid Grade Level: cited text averages ~16, non-cited ~19.1
  const fkGrade = fleschKincaidGrade(content.text);

  if (fkGrade >= 12 && fkGrade <= 18) {
    score += 6;
    findings.push(`Flesch-Kincaid grade: ${fkGrade.toFixed(1)} (cited content averages 16, non-cited 19.1). Good business-grade level.`);
  } else if (fkGrade >= 8 && fkGrade < 12) {
    score += 4;
    findings.push(`Flesch-Kincaid grade: ${fkGrade.toFixed(1)}. Slightly too simple. Cited content averages grade 16.`);
  } else if (fkGrade > 18 && fkGrade <= 22) {
    score += 3;
    findings.push(`Flesch-Kincaid grade: ${fkGrade.toFixed(1)}. Too academic/complex. Simplify sentence structure.`);
  } else if (fkGrade > 22) {
    score += 1;
    findings.push(`Flesch-Kincaid grade: ${fkGrade.toFixed(1)}. Overly complex. Business-grade writing (grade ~16) gets more citations.`);
  } else {
    score += 2;
    findings.push(`Flesch-Kincaid grade: ${fkGrade.toFixed(1)}. Aim for grade 12-18 (business-grade).`);
  }

  // Sentence length analysis
  const sentences = content.text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgWordsPerSentence = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(sentences.length, 1);

  if (avgWordsPerSentence >= 12 && avgWordsPerSentence <= 22) {
    score += 4;
    findings.push(`Average sentence length: ${avgWordsPerSentence.toFixed(1)} words. Good moderate length.`);
  } else if (avgWordsPerSentence < 12) {
    score += 2;
    findings.push(`Sentences are short (avg ${avgWordsPerSentence.toFixed(1)} words). Some complexity helps LLM citation.`);
  } else {
    score += 1;
    findings.push(`Sentences are too long (avg ${avgWordsPerSentence.toFixed(1)} words). Break into clearer subject-verb-object structures.`);
  }

  // Paragraph structure
  const avgParaLength = content.paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / Math.max(content.paragraphs.length, 1);
  if (avgParaLength >= 30 && avgParaLength <= 80) {
    score += 3;
    findings.push(`Good paragraph length (avg ${avgParaLength.toFixed(0)} words).`);
  } else if (avgParaLength < 30) {
    score += 2;
    findings.push(`Short paragraphs (avg ${avgParaLength.toFixed(0)} words). LLMs cite from mid-paragraph (53%). Add substance.`);
  } else {
    score += 1;
    findings.push(`Long paragraphs (avg ${avgParaLength.toFixed(0)} words). Break into focused, digestible blocks.`);
  }

  // List usage (structured content)
  const listItems = content.text.match(/(?:^|\n)\s*(?:[-*\u2022]|\d+[.)]) /gm);
  if (listItems && listItems.length >= 3) {
    score += 2;
    findings.push(`Uses structured lists (${listItems.length} items detected). Good for scanability.`);
  } else {
    findings.push('Consider adding bullet points or numbered lists for key information.');
  }

  return {
    name: 'Business-Grade Writing',
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    description: 'Cited text has a Flesch-Kincaid grade of ~16. Clear subject-verb-object structures win.',
    findings,
  };
}

// ─── Technical SEO (URL mode only) ───

function scoreTechnicalSEO(content: ParsedContent): CategoryScore | null {
  if (!content.meta) return null;

  const findings: string[] = [];
  let score = 0;
  const maxScore = 10;

  // Schema markup
  if (content.meta.schema && content.meta.schema.length > 0) {
    score += 4;
    findings.push(`Schema markup detected: ${content.meta.schema.join(', ')}`);
  } else {
    findings.push('No JSON-LD schema markup detected. Add Article, FAQ, HowTo, or other relevant schema.');
  }

  // Meta description
  if (content.meta.description) {
    if (content.meta.description.length >= 120 && content.meta.description.length <= 160) {
      score += 2;
      findings.push(`Meta description length: ${content.meta.description.length} chars (ideal: 120-160).`);
    } else {
      score += 1;
      findings.push(`Meta description exists but is ${content.meta.description.length} chars (ideal: 120-160).`);
    }
  } else {
    findings.push('No meta description found. Add one for LLM context.');
  }

  // Canonical URL
  if (content.meta.canonical) {
    score += 1;
    findings.push('Canonical URL is set.');
  } else {
    findings.push('No canonical URL detected.');
  }

  // Open Graph tags
  if (content.meta.ogTags && Object.keys(content.meta.ogTags).length >= 3) {
    score += 2;
    findings.push(`${Object.keys(content.meta.ogTags).length} Open Graph tags detected.`);
  } else {
    score += 0;
    findings.push('Limited or no Open Graph tags. Add og:title, og:description, og:type at minimum.');
  }

  // Title tag
  if (content.title) {
    score += 1;
    findings.push(`Page title: "${content.title}"`);
  } else {
    findings.push('No page title detected.');
  }

  return {
    name: 'Technical SEO & Schema',
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    description: 'Schema markup, meta tags, and technical signals help LLMs classify and trust your content.',
    findings,
  };
}

// ─── Inline annotation generation ───

function generateAnnotations(content: ParsedContent): InlineAnnotation[] {
  const annotations: InlineAnnotation[] = [];
  const text = content.text;
  const lower = text.toLowerCase();

  // 1. Flag vague openers
  for (const opener of VAGUE_OPENERS) {
    const idx = lower.indexOf(opener);
    if (idx !== -1) {
      annotations.push({
        text: text.substring(idx, idx + opener.length),
        startIndex: idx,
        endIndex: idx + opener.length,
        type: 'critical',
        category: 'Definitive Language',
        issue: 'Vague filler phrase. LLMs skip generic intros.',
        fix: 'Delete this phrase and start with a direct, definitive statement. Example: "[Topic] is the process of..."',
      });
    }
  }

  // 2. Flag hype words
  for (const hype of HYPE_WORDS) {
    const regex = new RegExp(`\\b${hype}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const replacements: Record<string, string> = {
        'amazing': 'effective',
        'incredible': 'significant',
        'revolutionary': 'innovative',
        'game-changing': 'impactful',
        'groundbreaking': 'novel',
        'mind-blowing': 'notable',
        'unbelievable': 'substantial',
        'insane': 'significant',
        'crazy': 'notable',
        'awesome': 'strong',
        'epic': 'major',
        'stunning': 'striking',
        'breathtaking': 'remarkable',
        'ultimate': 'comprehensive',
        'best ever': 'top-performing',
        'unprecedented': 'first-of-its-kind',
        'jaw-dropping': 'remarkable',
        'killer': 'high-performing',
        'must-have': 'essential',
        'skyrocket': 'increase significantly',
      };
      annotations.push({
        text: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        type: 'warning',
        category: 'Balanced Sentiment',
        issue: 'Hype language. LLMs prefer analyst-style writing over promotional tone.',
        fix: `Replace with measured language. Try: "${replacements[hype] || 'notable'}"`,
      });
    }
  }

  // 3. Flag headings that aren't questions
  for (const heading of content.headings) {
    const isQuestion = heading.text.includes('?') ||
      /^(?:what|how|why|when|where|who|which|can|do|does|is|are|should|will)\b/i.test(heading.text.trim());
    if (!isQuestion && heading.level >= 2) {
      const idx = text.indexOf(heading.text);
      if (idx !== -1) {
        annotations.push({
          text: heading.text,
          startIndex: idx,
          endIndex: idx + heading.text.length,
          type: 'suggestion',
          category: 'Question + Answer Structure',
          issue: 'This heading is not a question. Question-based headers get 2x more citations.',
          fix: `Rewrite as a question. Example: "What Is ${heading.text}?" or "How Does ${heading.text} Work?"`,
        });
      }
    }
  }

  // 4. Flag first paragraph if it lacks a definitive statement
  if (content.paragraphs.length > 0) {
    const firstPara = content.paragraphs[0];
    const definitiveCount = countDefinitiveStatements(firstPara);
    if (definitiveCount === 0 && firstPara.length > 30) {
      const idx = text.indexOf(firstPara);
      if (idx !== -1) {
        annotations.push({
          text: firstPara.length > 120 ? firstPara.substring(0, 120) + '...' : firstPara,
          startIndex: idx,
          endIndex: idx + Math.min(firstPara.length, 120),
          type: 'critical',
          category: 'Front-Loading (Ski Ramp)',
          issue: 'First paragraph lacks a clear topic definition. 44.2% of citations come from the first 30% of a page.',
          fix: 'Start with a definitive statement: "[Topic] is [clear definition]." State your conclusion or key point immediately.',
        });
      }
    }
  }

  // 5. Flag paragraphs with low entity density
  for (const para of content.paragraphs) {
    if (para.split(/\s+/).length < 15) continue; // skip short paragraphs
    const density = entityDensity(para);
    if (density < 0.03) {
      const idx = text.indexOf(para);
      if (idx !== -1) {
        annotations.push({
          text: para.length > 120 ? para.substring(0, 120) + '...' : para,
          startIndex: idx,
          endIndex: idx + Math.min(para.length, 120),
          type: 'warning',
          category: 'Entity Richness',
          issue: `Low entity density (${(density * 100).toFixed(1)}%) in this paragraph. Cited text averages 20.6%.`,
          fix: 'Add specific names: tools (e.g., "Google Search Console"), brands, frameworks, stats, or industry terms. Replace generic phrases with named examples.',
        });
      }
    }
  }

  // 6. Flag overly long sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount > 35) {
      const idx = text.indexOf(sentence);
      if (idx !== -1) {
        annotations.push({
          text: sentence.length > 120 ? sentence.substring(0, 120) + '...' : sentence,
          startIndex: idx,
          endIndex: idx + Math.min(sentence.length, 120),
          type: 'suggestion',
          category: 'Business-Grade Writing',
          issue: `This sentence is ${wordCount} words long. Cited content uses clear, moderate-length sentences.`,
          fix: 'Break into 2-3 shorter sentences with clear subject-verb-object structure. Aim for 12-22 words per sentence.',
        });
      }
    }
  }

  // 7. Flag question headings without direct answers
  for (const heading of content.headings) {
    const isQuestion = heading.text.includes('?') ||
      /^(?:what|how|why|when|where|who|which|can|do|does|is|are|should|will)\b/i.test(heading.text.trim());
    if (isQuestion) {
      const headingIdx = text.indexOf(heading.text);
      if (headingIdx === -1) continue;
      const afterHeading = text.substring(headingIdx + heading.text.length, headingIdx + heading.text.length + 300);
      const firstSentence = afterHeading.split(/[.!?]/)[0]?.trim() || '';
      if (firstSentence.length > 10 && !/\b(?:is|are|refers to|means|involves|consists of|includes|was|were)\b/i.test(firstSentence)) {
        const sentenceIdx = text.indexOf(firstSentence, headingIdx);
        if (sentenceIdx !== -1) {
          annotations.push({
            text: firstSentence.length > 120 ? firstSentence.substring(0, 120) + '...' : firstSentence,
            startIndex: sentenceIdx,
            endIndex: sentenceIdx + Math.min(firstSentence.length, 120),
            type: 'suggestion',
            category: 'Question + Answer Structure',
            issue: 'The paragraph after this question heading doesn\'t start with a direct answer.',
            fix: 'LLMs treat headers as prompts. Start the next paragraph with a direct answer: "[Subject] is..." or "[Subject] refers to..."',
          });
        }
      }
    }
  }

  // 8. Flag content missing conclusion/takeaway in first 30%
  const first30 = Math.floor(text.length * 0.3);
  const firstSection = text.substring(0, first30);
  const conclusionPattern = /\b(?:key takeaway|in short|the answer is|the result is|conclusion|bottom line|tl;dr|summary)\b/i;
  if (!conclusionPattern.test(firstSection) && text.length > 500) {
    // Check if conclusion appears later
    const laterMatch = conclusionPattern.exec(text.substring(first30));
    if (laterMatch) {
      const idx = first30 + laterMatch.index;
      annotations.push({
        text: text.substring(idx, Math.min(idx + 80, text.length)),
        startIndex: idx,
        endIndex: Math.min(idx + 80, text.length),
        type: 'suggestion',
        category: 'Front-Loading (Ski Ramp)',
        issue: 'Your key takeaway appears late in the content. LLMs heavily weight the top of the page.',
        fix: 'Move this conclusion or a summary version of it to the first 1-2 paragraphs.',
      });
    }
  }

  // Sort by position in document
  annotations.sort((a, b) => a.startIndex - b.startIndex);

  // Deduplicate overlapping annotations (keep the higher priority one)
  const typePriority = { critical: 0, warning: 1, suggestion: 2 };
  const deduped: InlineAnnotation[] = [];
  for (const ann of annotations) {
    const overlaps = deduped.some(
      (existing) => ann.startIndex < existing.endIndex && ann.endIndex > existing.startIndex
    );
    if (!overlaps) {
      deduped.push(ann);
    } else {
      // Replace if higher priority
      const overlapIdx = deduped.findIndex(
        (existing) => ann.startIndex < existing.endIndex && ann.endIndex > existing.startIndex
      );
      if (overlapIdx !== -1 && typePriority[ann.type] < typePriority[deduped[overlapIdx].type]) {
        deduped[overlapIdx] = ann;
      }
    }
  }

  return deduped;
}

// ─── Main analyze function ───

export function analyzeContent(content: ParsedContent): AnalysisResult {
  const categories: CategoryScore[] = [];

  const frontLoading = scoreFrontLoading(content);
  const definitiveLanguage = scoreDefinitiveLanguage(content);
  const qaStructure = scoreQuestionAnswerStructure(content);
  const entityRichness = scoreEntityRichness(content);
  const balancedSentiment = scoreBalancedSentiment(content);
  const businessGrade = scoreBusinessGradeWriting(content);

  categories.push(frontLoading, definitiveLanguage, qaStructure, entityRichness, balancedSentiment, businessGrade);

  // Add technical SEO if URL mode
  const techSEO = scoreTechnicalSEO(content);
  if (techSEO) {
    categories.push(techSEO);
  }

  // Calculate overall score
  const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
  const totalMax = categories.reduce((sum, c) => sum + c.maxScore, 0);
  const overallScore = Math.round((totalScore / totalMax) * 100);

  // Generate highlights
  const highlights: Highlight[] = [];

  // Top strengths
  const sorted = [...categories].sort((a, b) => (b.score / b.maxScore) - (a.score / a.maxScore));
  if (sorted[0].score / sorted[0].maxScore >= 0.7) {
    highlights.push({ type: 'positive', message: `Strongest area: ${sorted[0].name} (${sorted[0].score}/${sorted[0].maxScore})` });
  }

  // Top weaknesses
  const weakest = sorted[sorted.length - 1];
  if (weakest.score / weakest.maxScore < 0.5) {
    highlights.push({ type: 'critical', message: `Weakest area: ${weakest.name} (${weakest.score}/${weakest.maxScore})` });
  }

  // Word count check
  const wordCount = content.text.split(/\s+/).length;
  if (wordCount < 300) {
    highlights.push({ type: 'warning', message: `Content is short (${wordCount} words). Longer, substantive content tends to get more citations.` });
  } else if (wordCount >= 1000) {
    highlights.push({ type: 'positive', message: `Substantial content length (${wordCount} words).` });
  }

  // Generate summary
  let summary: string;
  if (overallScore >= 80) {
    summary = 'This content is well-optimized for LLM citations. It follows key patterns found in highly-cited content across 1.2M ChatGPT citations.';
  } else if (overallScore >= 60) {
    summary = 'This content has a solid foundation but needs improvements in key areas to maximize LLM citation potential.';
  } else if (overallScore >= 40) {
    summary = 'This content needs significant optimization to be competitive for LLM citations. Focus on the weakest categories first.';
  } else {
    summary = 'This content is not currently optimized for LLM citations. Major restructuring is recommended based on the findings below.';
  }

  // Generate inline annotations
  const annotations = generateAnnotations(content);

  return { overallScore, categories, highlights, summary, annotations };
}

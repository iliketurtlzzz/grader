import { ParsedContent } from './analyzer';

// Parse plain text content
export function parseText(text: string, title?: string): ParsedContent {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const headings: { level: number; text: string }[] = [];
  const paragraphs: string[] = [];

  let currentParagraph = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect markdown-style headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      headings.push({ level: headingMatch[1].length, text: headingMatch[2] });
      continue;
    }

    // Detect underline-style headings (line followed by === or ---)
    if (/^[=]{3,}$/.test(trimmed) && paragraphs.length > 0) {
      const lastPara = paragraphs.pop()!;
      headings.push({ level: 1, text: lastPara });
      continue;
    }
    if (/^[-]{3,}$/.test(trimmed) && paragraphs.length > 0) {
      const lastPara = paragraphs.pop()!;
      headings.push({ level: 2, text: lastPara });
      continue;
    }

    // Detect ALL-CAPS lines as headings (common in docs)
    if (trimmed.length > 5 && trimmed.length < 100 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
      headings.push({ level: 2, text: trimmed });
      continue;
    }

    // Short standalone lines that look like headings
    if (trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.endsWith(',') && trimmed.length > 3) {
      const words = trimmed.split(/\s+/);
      if (words.length <= 10 && words.some((w) => /^[A-Z]/.test(w))) {
        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        headings.push({ level: 2, text: trimmed });
        continue;
      }
    }

    // Regular paragraph text
    if (trimmed.length === 0) {
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    } else {
      currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
    }
  }

  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim());
  }

  return {
    title: title || headings[0]?.text || 'Untitled',
    text,
    headings,
    paragraphs,
  };
}

// Parse HTML content (from URL fetch or .html file)
export function parseHTML(html: string): ParsedContent {
  // We'll use cheerio on the server side
  // This is a simple fallback parser for basic HTML
  const headings: { level: number; text: string }[] = [];
  const paragraphs: string[] = [];

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Untitled';

  // Extract headings
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gis;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      text: match[2].replace(/<[^>]+>/g, '').trim(),
    });
  }

  // Extract paragraphs
  const paraRegex = /<p[^>]*>(.*?)<\/p>/gis;
  while ((match = paraRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }

  // Extract list items as part of content
  const liRegex = /<li[^>]*>(.*?)<\/li>/gis;
  while ((match = liRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }

  // Full text extraction
  const fullText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract meta information
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/is)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/is);
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/is)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/is);

  // Extract schema/JSON-LD
  const schemaTypes: string[] = [];
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type']) schemaTypes.push(data['@type']);
      if (Array.isArray(data['@graph'])) {
        data['@graph'].forEach((item: { '@type'?: string }) => {
          if (item['@type']) schemaTypes.push(item['@type']);
        });
      }
    } catch {
      // Invalid JSON-LD
    }
  }

  // Extract OG tags
  const ogTags: Record<string, string> = {};
  const ogRegex = /<meta[^>]*property=["'](og:[^"']+)["'][^>]*content=["']([^"']+)["']/gi;
  while ((match = ogRegex.exec(html)) !== null) {
    ogTags[match[1]] = match[2];
  }
  const ogRegex2 = /<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](og:[^"']+)["']/gi;
  while ((match = ogRegex2.exec(html)) !== null) {
    ogTags[match[2]] = match[1];
  }

  return {
    title,
    text: fullText,
    headings,
    paragraphs,
    html,
    meta: {
      description: metaDescMatch ? metaDescMatch[1] : undefined,
      schema: schemaTypes.length > 0 ? schemaTypes : undefined,
      canonical: canonicalMatch ? canonicalMatch[1] : undefined,
      ogTags: Object.keys(ogTags).length > 0 ? ogTags : undefined,
    },
  };
}

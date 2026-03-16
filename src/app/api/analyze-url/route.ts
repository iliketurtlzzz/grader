import { NextRequest, NextResponse } from 'next/server';
import { parseHTML } from '@/lib/parsers';
import { analyzeContent } from '@/lib/analyzer';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL. Include http:// or https://' }, { status: 400 });
    }

    // Fetch the URL
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'LLM-Content-Grader/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const content = parseHTML(html);
    const result = analyzeContent(content);

    return NextResponse.json({
      result,
      source: 'url',
      url: parsedUrl.toString(),
      documentText: content.text,
      paragraphs: content.paragraphs,
      headings: content.headings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}

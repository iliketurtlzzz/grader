import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { parseText, parseHTML } from '@/lib/parsers';
import { analyzeContent } from '@/lib/analyzer';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let content;

    if (fileName.endsWith('.docx')) {
      // Parse .docx using mammoth
      const result = await mammoth.convertToHtml({ buffer });
      content = parseHTML(result.value);
    } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      const text = buffer.toString('utf-8');
      content = parseHTML(text);
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      const text = buffer.toString('utf-8');
      content = parseText(text, file.name);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload .docx, .html, .txt, or .md files.' },
        { status: 400 }
      );
    }

    const result = analyzeContent(content);

    return NextResponse.json({
      result,
      source: 'document',
      fileName: file.name,
      documentText: content.text,
      paragraphs: content.paragraphs,
      headings: content.headings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}

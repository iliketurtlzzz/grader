import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LLM Content Grader - Optimize Content for AI Citations',
  description:
    'Audit your content for LLM citation readiness. Get a 1-100 score based on data from 1.2M verified ChatGPT citations. Built for marketers and copywriters.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

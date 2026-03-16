'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

interface AnalysisResult {
  overallScore: number;
  categories: CategoryScore[];
  highlights: Highlight[];
  summary: string;
}

interface GradeRecord {
  id: string;
  fileName: string;
  score: number;
  date: string;
  result: AnalysisResult;
  source: 'document' | 'url';
  url?: string;
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

// ─── Score Circle Component ───

function ScoreCircle({ score, size = 180 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--score-bg)"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreHex(score)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-circle"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span
          className="text-sm font-medium mt-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          {getScoreLabel(score)}
        </span>
      </div>
    </div>
  );
}

// ─── Mini Score Circle ───

function MiniScore({ score, size = 44 }: { score: number; size?: number }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--score-bg)"
          strokeWidth="3"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getScoreHex(score)}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={`absolute text-xs font-bold ${getScoreColor(score)}`}
      >
        {score}
      </span>
    </div>
  );
}

// ─── Theme Toggle ───

function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: string;
  setTheme: (t: string) => void;
}) {
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="btn-secondary flex items-center gap-2 text-sm"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          Light
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          Dark
        </>
      )}
    </button>
  );
}

// ─── Category Detail View ───

function CategoryDetail({
  category,
  onBack,
}: {
  category: CategoryScore;
  onBack: () => void;
}) {
  const pct = Math.round((category.score / category.maxScore) * 100);

  return (
    <div>
      <button
        onClick={onBack}
        className="btn-secondary mb-6 flex items-center gap-2 text-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Results
      </button>

      <div className="card p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{category.name}</h2>
            <p style={{ color: 'var(--text-secondary)' }} className="mt-1">
              {category.description}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-4xl font-bold ${getScoreColor(pct)}`}>
              {category.score}
            </span>
            <span style={{ color: 'var(--text-muted)' }} className="text-lg">
              /{category.maxScore}
            </span>
          </div>
        </div>

        <div className="progress-bar mb-8" style={{ height: '12px' }}>
          <div
            className="progress-fill"
            style={{
              width: `${pct}%`,
              background: getCategoryBarColor(category.score, category.maxScore),
            }}
          />
        </div>

        <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
        <div className="space-y-3">
          {category.findings.map((finding, i) => {
            const isPositive =
              finding.toLowerCase().includes('good') ||
              finding.toLowerCase().includes('strong') ||
              finding.toLowerCase().includes('excellent') ||
              finding.toLowerCase().includes('clean') ||
              finding.toLowerCase().includes('avoids') ||
              finding.toLowerCase().includes('balanced') ||
              finding.toLowerCase().includes('contains');
            const isNegative =
              finding.toLowerCase().includes('no ') ||
              finding.toLowerCase().includes('low') ||
              finding.toLowerCase().includes('only') ||
              finding.toLowerCase().includes('limited') ||
              finding.toLowerCase().includes('excessive') ||
              finding.toLowerCase().includes('too ') ||
              finding.toLowerCase().includes('eliminate') ||
              finding.toLowerCase().includes('remove');

            return (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <span className="mt-0.5 flex-shrink-0">
                  {isPositive ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isNegative ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  )}
                </span>
                <span className="text-sm leading-relaxed">{finding}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Results View ───

function ResultsView({
  result,
  fileName,
  onBack,
  onRegrade,
}: {
  result: AnalysisResult;
  fileName: string;
  onBack: () => void;
  onRegrade: () => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryScore | null>(null);

  if (selectedCategory) {
    return (
      <CategoryDetail
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button onClick={onRegrade} className="btn-primary text-sm">
          Re-Grade Updated Copy
        </button>
      </div>

      {/* Score header */}
      <div className="card p-8 text-center mb-8">
        <p style={{ color: 'var(--text-secondary)' }} className="mb-2 text-sm">
          {fileName}
        </p>
        <ScoreCircle score={result.overallScore} />
        <p
          style={{ color: 'var(--text-secondary)' }}
          className="mt-4 max-w-xl mx-auto text-sm leading-relaxed"
        >
          {result.summary}
        </p>
      </div>

      {/* Highlights */}
      {result.highlights.length > 0 && (
        <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {result.highlights.map((h, i) => (
            <div
              key={i}
              className="card p-4 flex items-start gap-3"
              style={{
                borderLeftWidth: '3px',
                borderLeftColor:
                  h.type === 'positive'
                    ? '#22c55e'
                    : h.type === 'warning'
                    ? '#eab308'
                    : '#ef4444',
              }}
            >
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
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat)}
              className="card p-5 w-full text-left flex items-center gap-5 group"
            >
              <MiniScore score={pct} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{cat.name}</span>
                  <span
                    style={{ color: 'var(--text-muted)' }}
                    className="text-sm"
                  >
                    {cat.score}/{cat.maxScore}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: getCategoryBarColor(cat.score, cat.maxScore),
                    }}
                  />
                </div>
                <p
                  style={{ color: 'var(--text-muted)' }}
                  className="text-xs mt-2 truncate"
                >
                  {cat.description}
                </p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                className="flex-shrink-0 group-hover:translate-x-1 transition-transform"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main App ───

export default function Home() {
  const [theme, setTheme] = useState('dark');
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [view, setView] = useState<'home' | 'results' | 'history'>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [currentFileName, setCurrentFileName] = useState('');
  const [history, setHistory] = useState<GradeRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load theme and history from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('stopslop-theme');
    if (savedTheme) setTheme(savedTheme);
    const savedHistory = localStorage.getItem('stopslop-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {
        // ignore
      }
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
    (result: AnalysisResult, fileName: string, source: 'document' | 'url', urlValue?: string) => {
      const record: GradeRecord = {
        id: Date.now().toString(),
        fileName,
        score: result.overallScore,
        date: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        result,
        source,
        url: urlValue,
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
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Analysis failed');
        return;
      }

      setCurrentResult(data.result);
      setCurrentFileName(data.fileName);
      saveToHistory(data.result, data.fileName, 'document');
      setView('results');
    } catch {
      setError('Failed to connect to the server. Make sure the app is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlAnalyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Analysis failed');
        return;
      }

      setCurrentResult(data.result);
      setCurrentFileName(data.url || url);
      saveToHistory(data.result, data.url || url, 'url', data.url);
      setView('results');
    } catch {
      setError('Failed to connect to the server. Make sure the app is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const openHistoryItem = (record: GradeRecord) => {
    setCurrentResult(record.result);
    setCurrentFileName(record.fileName);
    setView('results');
  };

  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
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
          onBack={() => setView('home')}
          onRegrade={() => {
            setView('home');
            setCurrentResult(null);
          }}
        />
      </div>
    );
  }

  // ─── Home view ───
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div />
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>

      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black tracking-tighter mb-3">STOPSLOP</h1>
        <p style={{ color: 'var(--text-secondary)' }} className="text-lg max-w-md mx-auto">
          Grade your content for LLM citation readiness. Audit copy before it goes live.
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-2 p-1 rounded-lg mb-6 mx-auto w-fit"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <button
          className={`tab ${tab === 'upload' ? 'active' : ''}`}
          onClick={() => setTab('upload')}
        >
          Upload Document
        </button>
        <button
          className={`tab ${tab === 'url' ? 'active' : ''}`}
          onClick={() => setTab('url')}
        >
          Analyze URL
        </button>
      </div>

      {/* Upload / URL input */}
      {tab === 'upload' ? (
        <div
          className={`drop-zone rounded-xl p-12 text-center cursor-pointer ${
            dragging ? 'dragging' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.html,.htm,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            className="mx-auto mb-4"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="font-semibold mb-1">
            {loading ? 'Analyzing...' : 'Drop your file here or click to upload'}
          </p>
          <p style={{ color: 'var(--text-muted)' }} className="text-sm">
            Supports .docx, .html, .txt, .md
          </p>
        </div>
      ) : (
        <div className="card p-6">
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Page URL
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/your-page"
              className="flex-1 px-4 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlAnalyze();
              }}
            />
            <button
              onClick={handleUrlAnalyze}
              disabled={loading || !url.trim()}
              className="btn-primary text-sm whitespace-nowrap"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)' }} className="text-xs mt-2">
            Also checks schema markup, meta tags, and Open Graph data
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="mt-4 p-4 rounded-lg text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="mt-8 text-center">
          <div
            className="inline-block w-8 h-8 border-2 rounded-full animate-spin"
            style={{
              borderColor: 'var(--border)',
              borderTopColor: 'var(--accent)',
            }}
          />
          <p style={{ color: 'var(--text-secondary)' }} className="mt-3 text-sm">
            Analyzing content against LLM citation criteria...
          </p>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Past Grades</h2>
            <button
              onClick={clearHistory}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2">
            {history.map((record) => (
              <div
                key={record.id}
                className="history-item flex items-center gap-4"
              >
                <button
                  className="flex-1 flex items-center gap-4 text-left"
                  onClick={() => openHistoryItem(record)}
                >
                  <MiniScore score={record.score} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {record.fileName}
                    </p>
                    <p
                      style={{ color: 'var(--text-muted)' }}
                      className="text-xs"
                    >
                      {record.date} &middot;{' '}
                      {record.source === 'url' ? 'URL' : 'Document'}
                    </p>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteHistoryItem(record.id);
                  }}
                  className="flex-shrink-0 p-1 rounded hover:bg-red-500/10"
                  title="Delete"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 text-center">
        <p style={{ color: 'var(--text-muted)' }} className="text-xs">
          Grading criteria based on analysis of 1.2M verified ChatGPT citations
          (Growth Memo / Gauge)
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mafia AI — AI Social Deduction Platform',
  description: 'Watch AI agents play social deduction in real-time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-terminal-bg text-terminal-text antialiased">
        <nav className="border-b border-terminal-border px-4 py-3 flex items-center gap-6">
          <a href="/" className="text-sm font-bold text-terminal-green tracking-widest">
            MAFIA<span className="text-terminal-muted">://</span>AI
          </a>
          <a href="/" className="text-xs text-terminal-muted hover:text-terminal-text transition-colors">
            Games
          </a>
          <a href="/games" className="text-xs text-terminal-muted hover:text-terminal-text transition-colors">
            Browser
          </a>
          <a href="/guide" className="text-xs text-terminal-muted hover:text-terminal-text transition-colors">
            Connect Guide
          </a>
          <div className="ml-auto text-xs text-terminal-muted">
            AI Social Deduction Platform
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

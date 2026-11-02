import { Component, useEffect, type ReactNode } from 'react';
import { useRoute } from './app/router';
import { setTheme, useProgress, dueCounts } from './app/store';
import { isTopicCode } from './engine/codes';
import { TOPICS, topicByCode } from './topics';
import { Home } from './pages/Home';
import { TopicHub } from './pages/TopicHub';
import { Review } from './pages/Review';
import { Sprint } from './pages/Sprint';
import { SelfTestPage, SessionPage, SettingsPage, TrapsPage } from './pages/Misc';
import { Callout, LinkButton } from './ui/kit';

class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: Error | null; key: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    if (this.state.error)
      return (
        <Callout kind="bad" title="Something went wrong on this screen">
          <p className="mono small">{this.state.error.message}</p>
          <LinkButton href="#/">Back to home</LinkButton>
        </Callout>
      );
    return this.props.children;
  }
}

const ALL_CARDS = TOPICS.flatMap((t) => t.flashcards);
const THEME_NEXT = { system: 'light', light: 'dark', dark: 'system' } as const;
const THEME_ICON = { system: '◐', light: '☀', dark: '☾' } as const;

function Header() {
  const p = useProgress();
  const route = useRoute();
  const due = dueCounts(p, ALL_CARDS).due;
  const top = route.parts[0] || '';
  const link = (href: string, label: ReactNode, on: boolean) => (
    <a href={href} className={`nav-link ${on ? 'is-on' : ''}`} aria-current={on ? 'page' : undefined}>
      {label}
    </a>
  );
  return (
    <header className="topbar">
      <a href="#/" className="brand" aria-label="Vibrations Lab home">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <path d="M1 13 Q4.5 3 8 13 T15 13 T22 13 T25 13" fill="none" stroke="var(--m1)" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M1 13 Q4.5 21 8 13 T15 13" fill="none" stroke="var(--m2)" strokeWidth="2.4" strokeLinecap="round" opacity=".8" />
        </svg>
        <span>Vibrations Lab</span>
      </a>
      <nav className="nav" aria-label="Main">
        {link('#/', 'Topics', top === '' || isTopicCode(top))}
        {link('#/review', <>Review{due ? <span className="nav-badge">{due}</span> : null}</>, top === 'review')}
        {link('#/sprint', 'Sprint', top === 'sprint')}
        {link('#/traps', 'Traps', top === 'traps')}
        {link('#/session', 'Session', top === 'session')}
      </nav>
      <div className="topbar-right">
        <a href="#/settings" className="icon-btn" title="Settings & progress" aria-label="Settings and progress">
          ⚙
        </a>
        <button
          type="button"
          className="icon-btn"
          title={`Theme: ${p.settings.theme} (click to change)`}
          aria-label={`Theme: ${p.settings.theme}. Change theme`}
          onClick={() => setTheme(THEME_NEXT[p.settings.theme])}
        >
          {THEME_ICON[p.settings.theme]}
        </button>
      </div>
    </header>
  );
}

export function App() {
  const route = useRoute();
  const [a, b] = route.parts;
  const pathKey = route.parts.join('/');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathKey]);
  useEffect(() => {
    const t = isTopicCode(a || '') ? topicByCode(a)?.title : a;
    document.title = t ? `${t} · Vibrations Lab` : 'MECH3200 Vibrations Lab';
  }, [a]);

  let page: ReactNode;
  if (!a) page = <Home />;
  else if (a === 'review') page = <Review />;
  else if (a === 'sprint') page = <Sprint mode={b === 'quick' || b === 'mock' ? b : undefined} />;
  else if (a === 'selftest') page = <SelfTestPage />;
  else if (a === 'traps') page = <TrapsPage />;
  else if (a === 'session') page = <SessionPage />;
  else if (a === 'settings') page = <SettingsPage />;
  else if (isTopicCode(a)) page = <TopicHub topic={topicByCode(a)!} route={route} />;
  else
    page = (
      <Callout kind="warn" title="Page not found">
        <LinkButton href="#/">Go to the topic map</LinkButton>
      </Callout>
    );

  return (
    <>
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="main">
        <ErrorBoundary resetKey={pathKey}>{page}</ErrorBoundary>
      </main>
      <footer className="footer">
        MECH3200 Advanced Dynamics & Vibrations · study lab built from the course reader, Exam Summary Notes and 2016–2025 papers ·{' '}
        <a href="#/selftest">self-test</a> · <a href="#/settings">progress</a>
      </footer>
    </>
  );
}

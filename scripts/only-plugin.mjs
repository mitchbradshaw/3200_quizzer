// esbuild plugin: with M32_ONLY="A2,A3" every other topic (and its self-tests) is replaced by an
// empty stub, so one topic can be built and tested while other topics are mid-edit.
import path from 'node:path';

const CODE = /(A[1-6]|B[1-6]|C[1-4])/;

export function onlyPlugin(ROOT, onlyEnv = process.env.M32_ONLY) {
  const only = onlyEnv ? new Set(onlyEnv.split(/[,\s]+/).filter(Boolean).map((s) => s.toUpperCase())) : null;
  return {
    name: 'm32-only',
    setup(b) {
      if (!only) return;
      b.onResolve({ filter: /^\.\/(A[1-6]|B[1-6]|C[1-4])$/ }, (a) => {
        if (!a.importer.replace(/\\/g, '/').endsWith('src/topics/index.ts')) return undefined;
        const code = a.path.slice(2);
        return only.has(code) ? undefined : { path: code, namespace: 'm32-stub-topic' };
      });
      b.onResolve({ filter: /topics\/(A[1-6]|B[1-6]|C[1-4])\/selftests$/ }, (a) => {
        const code = a.path.match(CODE)[1];
        return only.has(code) ? undefined : { path: code, namespace: 'm32-stub-tests' };
      });
      b.onLoad({ filter: /.*/, namespace: 'm32-stub-topic' }, (a) => ({
        contents: `import { TOPIC_META } from ${JSON.stringify(path.join(ROOT, 'src', 'topics', 'meta.ts').replace(/\\/g, '/'))};
export default { ...TOPIC_META[${JSON.stringify(a.path)}], cards: [], flashcards: [], mcqs: [], games: [], shortAnswers: [], solve: [], explore: [] };`,
        loader: 'ts',
        resolveDir: ROOT,
      }));
      // The content lint imports every topic's quiz bank directly; stub the ones outside M32_ONLY too.
      b.onResolve({ filter: /topics\/(A[1-6]|B[1-6]|C[1-4])\/quiz$/ }, (a) => {
        const code = a.path.match(CODE)[1];
        return only.has(code) ? undefined : { path: code, namespace: 'm32-stub-quiz' };
      });
      b.onLoad({ filter: /.*/, namespace: 'm32-stub-tests' }, () => ({ contents: 'export const tests = [];', loader: 'ts' }));
      b.onLoad({ filter: /.*/, namespace: 'm32-stub-quiz' }, () => ({ contents: 'export const mcqs = []; export const games = []; export const shortAnswers = [];', loader: 'ts' }));
    },
  };
}

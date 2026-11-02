// Plain-text (Unicode) reading of the simple TeX in A2's energy terms, for accessible names that screen
// readers can tell apart: '$\\tfrac12 m\\dot x^2$' → '½ m ẋ²', '$\\tfrac12 k_1(y - a\\theta)^2$' → '½ k₁(y − a θ)²'.
// It covers what the A2 tiles use (fractions, dots, sub/superscripts, Greek letters, \cos, \sqrt, \left/\right,
// \cdot, \approx, spacing); anything else falls back to its command name. Pure: no DOM, no KaTeX.

type Kind = 'sym' | 'op' | 'open' | 'close' | 'sp';
interface Atom {
  s: string;
  k: Kind;
}

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ',
  kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ',
  psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};
const OPS: Record<string, string> = { cdot: '·', times: '×', approx: '≈', pm: '±', mp: '∓', neq: '≠', ne: '≠', le: '≤', leq: '≤', ge: '≥', geq: '≥', to: '→' };
const SYMS: Record<string, string> = { infty: '∞', partial: '∂', ell: 'ℓ', circ: '°', prime: '′' };
const FUNCS = new Set(['cos', 'sin', 'tan', 'cot', 'sec', 'exp', 'ln', 'log', 'det', 'max', 'min']);
const SPACES = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad']);
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '−': '⁻', T: 'ᵀ' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const VULGAR: Record<string, string> = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '1/6': '⅙', '1/8': '⅛' };

/** Join atoms with readable spacing: factors separated ("m ẋ²"), binary operators spaced ("x + y"). */
function join(atoms: Atom[]): string {
  let s = '';
  let prev: Atom | null = null;
  for (const a of atoms) {
    if (a.k === 'sp') {
      if (s && !s.endsWith(' ')) s += ' ';
    } else if (a.k === 'op') {
      const unary = (a.s === '−' || a.s === '+') && (!prev || prev.k === 'open' || prev.k === 'op');
      if (unary) s += a.s;
      else if (a.s === ',') s = `${s.trimEnd()}, `;
      else if (a.s === '/') s = `${s.trimEnd()}/`;
      else s = `${s.trimEnd()} ${a.s} `;
    } else {
      const gap = prev && ((prev.k === 'sym' && a.k === 'sym') || (prev.k === 'close' && (a.k === 'sym' || a.k === 'open')));
      if (gap && !s.endsWith(' ')) s += ' ';
      s += a.s;
    }
    prev = a;
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Characters of a script, mapped to Unicode super/subscripts when every one has a form; else ^x / _x. */
function script(body: string, map: Record<string, string>, mark: string): string {
  const chars = [...body];
  if (chars.length && chars.every((c) => map[c] !== undefined)) return chars.map((c) => map[c]).join('');
  return `${mark}${chars.length > 1 ? `(${body})` : body}`;
}

/** Wrap a fraction part in parentheses when it is more than one factor. */
const wrapPart = (s: string) => (/[\s+−=]/.test(s) ? `(${s})` : s);

function parse(src: string): Atom[] {
  let i = 0;
  const skipSpace = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };

  /** One argument: a {group}, a \command, or a single character. */
  const arg = (): Atom[] => {
    skipSpace();
    if (i >= src.length) return [];
    if (src[i] === '{') {
      i++;
      return seq(true);
    }
    if (src[i] === '\\') return command();
    const c = src[i++];
    return token(c);
  };

  const token = (c: string): Atom[] => {
    if (/[A-Za-z]/.test(c)) return [{ s: c, k: 'sym' }];
    if (/[0-9.]/.test(c)) return [{ s: c, k: 'sym' }];
    if (c === '+') return [{ s: '+', k: 'op' }];
    if (c === '-') return [{ s: '−', k: 'op' }];
    if (c === '=' || c === '<' || c === '>') return [{ s: c, k: 'op' }];
    if (c === ',' || c === '/') return [{ s: c, k: 'op' }];
    if (c === '(' || c === '[') return [{ s: c, k: 'open' }];
    if (c === ')' || c === ']') return [{ s: c, k: 'close' }];
    if (c === '&' || c === '~') return [{ s: ' ', k: 'sp' }];
    if (c === "'") return [{ s: '′', k: 'sym' }];
    return [{ s: c, k: 'sym' }];
  };

  const command = (): Atom[] => {
    i++; // the backslash
    let name = '';
    if (/[A-Za-z]/.test(src[i] ?? '')) while (i < src.length && /[A-Za-z]/.test(src[i])) name += src[i++];
    else name = src[i++] ?? '';
    if (SPACES.has(name) || name === '\\') return [{ s: ' ', k: 'sp' }];
    if (name === 'left' || name === 'right' || name === 'big' || name === 'Big' || name === 'bigl' || name === 'bigr') {
      skipSpace();
      if (src[i] === '.') {
        i++;
        return [];
      }
      if (src[i] === '\\') return command();
      return i < src.length ? token(src[i++]) : [];
    }
    if (name === 'tfrac' || name === 'frac' || name === 'dfrac') {
      const num = join(arg());
      const den = join(arg());
      return [{ s: VULGAR[`${num}/${den}`] ?? `${wrapPart(num)}/${wrapPart(den)}`, k: 'sym' }];
    }
    if (name === 'dot' || name === 'ddot') {
      const body = join(arg());
      return [{ s: `${body}${name === 'dot' ? '̇' : '̈'}`, k: 'sym' }];
    }
    if (name === 'sqrt') {
      const body = join(arg());
      return [{ s: `√${[...body].length > 1 ? `(${body})` : body}`, k: 'sym' }];
    }
    if (name === 'text' || name === 'mathrm' || name === 'mathit' || name === 'mathbf' || name === 'operatorname') {
      skipSpace();
      if (src[i] !== '{') return arg();
      const start = ++i;
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
      }
      return [{ s: src.slice(start, i - 1), k: 'sym' }];
    }
    if (name === '{' || name === '}') return [{ s: name, k: name === '{' ? 'open' : 'close' }];
    if (GREEK[name]) return [{ s: GREEK[name], k: 'sym' }];
    if (OPS[name]) return [{ s: OPS[name], k: 'op' }];
    if (SYMS[name]) return [{ s: SYMS[name], k: 'sym' }];
    if (FUNCS.has(name)) return [{ s: name, k: 'sym' }];
    return name ? [{ s: name, k: 'sym' }] : [];
  };

  /** A run of atoms up to the end (or the closing brace of a group). */
  const seq = (inGroup: boolean): Atom[] => {
    const out: Atom[] = [];
    while (i < src.length) {
      const c = src[i];
      if (c === '}') {
        i++;
        if (inGroup) return out;
        continue;
      }
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (c === '^' || c === '_') {
        i++;
        // Scripts are read tight: x_{lo} → x_(lo), not x_(l o).
        const body = arg()
          .map((a) => a.s)
          .join('');
        const s = c === '^' ? script(body, SUP, '^') : script(body, SUB, '_');
        const last = out[out.length - 1];
        if (last && last.k !== 'op' && last.k !== 'sp' && last.k !== 'open') last.s += s;
        else out.push({ s, k: 'sym' });
        continue;
      }
      if (c === '{') {
        i++;
        out.push(...seq(true));
        continue;
      }
      if (c === '\\') {
        out.push(...command());
        continue;
      }
      i++;
      // Multi-digit numbers stay together ("12.5"), letters are separate factors ("MgL" → "M g L").
      if (/[0-9]/.test(c)) {
        let num = c;
        while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
        out.push({ s: num, k: 'sym' });
        continue;
      }
      out.push(...token(c));
    }
    return out;
  };

  return seq(false);
}

/** Plain-text reading of one TeX expression (no $ delimiters). */
export function speakTeX(tex: string): string {
  return join(parse(tex)).normalize('NFC');
}

/**
 * Accessible name of an energy term: its role and its expression in plain text, e.g. "cart: ½ m ẋ²" (the KaTeX
 * HTML is not readable by screen readers, and several terms share a role). A trailing "(role)" is not repeated.
 */
export function termName(t: { role: string; tex: string }): string {
  const expr = speakRich(t.tex);
  const tail = ` (${t.role})`;
  return `${t.role}: ${expr.endsWith(tail) ? expr.slice(0, -tail.length) : expr}`;
}

/** Plain-text reading of a Rich string: TeX between $…$ converted, **bold** / *italic* / `code` markers dropped. */
export function speakRich(rich: string): string {
  const src = rich.replace(/\\\$/g, '\u0000');
  const out = src.replace(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g, (_m, d?: string, t?: string) => speakTeX((d ?? t ?? '').split('\u0000').join('$')));
  return out
    .replace(/\*\*|\*|`/g, '')
    .split('\u0000')
    .join('$')
    .replace(/\s+/g, ' ')
    .trim();
}

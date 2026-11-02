// Safe calculator for answer boxes: numbers plus + − × ÷ ^ ( ), pi, e and common functions.
// e.g. "2*pi*12.5", "sqrt(3e5/12)", "1.2e3", "60/(2π)". Never uses eval.

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  abs: Math.abs,
};

function normalise(src: string): string {
  let s = src.trim().replace(/\s+/g, '');
  s = s.replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (!s.includes('.') && /^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  return s.toLowerCase();
}

export function evaluate(src: string): number {
  const s = normalise(src);
  if (!s) return NaN;
  let i = 0;
  const peek = () => s[i];
  const eat = (ch: string) => {
    if (s[i] === ch) {
      i++;
      return true;
    }
    return false;
  };

  function number(): number {
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (!m) return NaN;
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function ident(): string {
    const m = /^[a-z]+/.exec(s.slice(i));
    if (!m) return '';
    i += m[0].length;
    return m[0];
  }
  function primary(): number {
    if (eat('(')) {
      const v = expr();
      if (!eat(')')) return NaN;
      return v;
    }
    const ch = peek();
    if (ch && /[\d.]/.test(ch)) return number();
    if (ch && /[a-z]/.test(ch)) {
      const id = ident();
      if (id === 'pi') return Math.PI;
      if (id === 'e') return Math.E;
      const fn = FUNCS[id];
      if (!fn) return NaN;
      if (!eat('(')) {
        // allow "sqrt2"
        const v = factor();
        return fn(v);
      }
      const v = expr();
      if (!eat(')')) return NaN;
      return fn(v);
    }
    return NaN;
  }
  function implicit(v: number): number {
    // 2pi, 3(4+1), 2sqrt(2)
    while (i < s.length && /[a-z(]/.test(s[i])) v *= primary();
    return v;
  }
  function factor(): number {
    if (eat('-')) return -factor();
    if (eat('+')) return factor();
    let base = implicit(primary());
    if (eat('^')) base = Math.pow(base, factor());
    return base;
  }
  function term(): number {
    let v = factor();
    for (;;) {
      if (eat('*')) v *= factor();
      else if (eat('/')) v /= factor();
      else return v;
    }
  }
  function expr(): number {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  }
  const v = expr();
  return i === s.length ? v : NaN;
}

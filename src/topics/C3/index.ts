// Topic C3: digital signal processing (LC3). Content follows the reader and the Exam Summary Notes;
// see docs/AUTHORING.md for the structure (A1 is the reference topic).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.C3,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'nyquist-half', title: 'Nyquist is fs/2', detail: 'The highest frequency an FFT shows is half the sampling rate, $1/(2\\Delta t)$: compare tones with $f_s/2$, and sample at $f_s > 2f_{max}$.' },
    { id: 'lines-half', title: 'N samples give N/2 lines', detail: 'The upper half of the DFT mirrors the lower half, so $N$ samples give $N/2$ lines up to the Nyquist frequency.' },
    { id: 'resolution-record', title: 'Resolution comes from the record length only', detail: '$\\Delta f = 1/T$. Raising $f_s$ at the same $T$ raises the Nyquist frequency and $N$, not the resolution.' },
    { id: 'alias-fold', title: 'Fold about multiples of fs', detail: 'The alias is $|f - kf_s|$ with $k = \\text{round}(f/f_s)$, in $[0, f_s/2]$; not $f - f_s/2$, and not clipped at $f_s/2$.' },
    { id: 'alias-incomplete', title: 'Fold all the way into [0, fs/2]', detail: 'Subtracting $f_s$ once is not always enough: use the **nearest** multiple, $k = \\text{round}(f/f_s)$, and check that the result lies between 0 and $f_s/2$. 430 Hz at 200 samples/s: 430 − 200 = 230 Hz is still above the 100 Hz Nyquist frequency; |430 − 2 × 200| = 30 Hz.' },
    { id: 'gcd-not-spacing', title: 'Largest Δf for sharp peaks is the gcd of the tones', detail: '$\\Delta f$ below the closest spacing is only necessary; every tone must sit on a line, so $\\Delta f$ must divide every tone frequency.' },
    { id: 'window-correction', title: 'Correct windowed amplitudes by the coherent gain', detail: 'A Hann-windowed single spectrum reads half the amplitude (×2 to correct); for an FRF the same window on both channels cancels.' },
    { id: 'h1h2-swap', title: 'H₁ = S_fx/S_ff, H₂ = S_xx/S_xf', detail: '$H_1$ divides by the excitation auto-spectrum; $H_2$ has the response auto-spectrum on top.' },
    { id: 'noise-bias-direction', title: 'Input noise pulls H₁ low; output noise pushes H₂ high', detail: '$|H_1| \\le |H| \\le |H_2|$; each estimate is unbiased by the noise on the other channel.' },
    { id: 'rms-vs-power', title: 'Square RMS ratios to get power ratios', detail: 'Noise at 30 % of the signal RMS is a power ratio of 0.09.' },
    { id: 'coherence-single', title: 'One record always gives coherence 1', detail: 'With a single average $|S_{xf}|^2 = S_{ff}S_{xx}$ exactly; average several records before reading coherence.' },
  ],
  seeAlso: [
    { label: 'C1 Transducers and excitation', href: '#/C1/learn', note: 'Hammer tips, contact time and excitation bandwidth: why a soft tip ruins high-frequency coherence.' },
    { label: 'C2 FRFs and modal parameters', href: '#/C2/learn', note: 'What to do with a good FRF: half-power damping, real/imaginary plots, mode shapes.' },
  ],
};

export default topic;

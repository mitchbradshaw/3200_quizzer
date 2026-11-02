// Topic C1: transducers and excitation (reader LC1; summary notes C1).
import type { TopicDef } from '../../engine/types';
import { TOPIC_META } from '../meta';
import { cards, flashcards } from './learn';
import { games, mcqs, shortAnswers } from './quiz';
import { generators } from './solve';
import { explore } from './explore';

const topic: TopicDef = {
  ...TOPIC_META.C1,
  cards,
  flashcards,
  mcqs,
  games,
  shortAnswers,
  solve: generators,
  explore,
  traps: [
    { id: 'c1-relative-accel', title: 'Piezo charge follows relative deflection', detail: 'The charge comes from the relative deflection $z$ of the seismic mass; below resonance that deflection is proportional to the **case** acceleration (official 2018/2019 A3.4(d)).' },
    { id: 'c1-regime', title: 'Accelerometer β ≪ 1, vibrometer β ≫ 1', detail: 'Stiff and light → high $\\omega_n$ → accelerometer. Soft and heavy → low $\\omega_n$ → displacement vibrometer ($z \\approx -y$).' },
    { id: 'c1-sensitivity', title: 'Stiff and light buys bandwidth, not sensitivity', detail: 'Deflection per unit acceleration is $1/\\omega_n^2$: a stiffer, lighter sensor is **less** sensitive, hence the charge amplifier.' },
    { id: 'c1-piezo-dc', title: 'Piezo accelerometers cannot measure static acceleration', detail: 'The charge decays; use resistive/capacitive (MEMS) types for gravity, tilt and DC to a few Hz (LC1-7).' },
    { id: 'c1-tip-range', title: 'Harder tip → shorter pulse → wider range', detail: 'A softer tip or a heavier hammer narrows the range. The structure’s stiffness only drops out when the tip is much **softer** than it.' },
    { id: 'c1-useful-range', title: 'Useful range ends at the 10–20 dB drop', detail: 'Modes beyond the −20 dB point get almost no force; −50 dB is noise, not “useful”.' },
    { id: 'c1-shaker-hammer', title: 'Shaker signals vs the hammer impulse', detail: 'Stepped sine, sweeps, burst sine, chirp and random need a shaker; a hammer gives only an impulse.' },
    { id: 'c1-db-amplitude', title: 'Spectra in dB use 20 log₁₀ of amplitude', detail: '−10 dB ≈ 1/3 and −20 dB = 0.1 for amplitudes; power ratios (and coherence) use $10^{-\\text{dB}/10}$.' },
    { id: 'c1-coherence-snr', title: 'Low coherence means low signal-to-noise', detail: 'Where the force (soft tip, high frequency) or the response (node, anti-resonance) is small, noise dominates and coherence drops.' },
    { id: 'c1-linear-frf', title: 'Hit strength does not change a linear FRF', detail: '$H = X/F$; each hit is normalised by its own measured force. Harder hits only improve signal-to-noise (Week 12 Q4).' },
  ],
};

export default topic;

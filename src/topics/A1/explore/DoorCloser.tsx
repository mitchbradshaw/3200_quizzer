// Challenge: set the door-closer damping so the door shuts fastest without passing the closed position (2021 A1.1).
import { useMemo, useRef, useState } from 'react';
import { criticalDamping, dampingRatio, freeResponse, naturalFrequency } from '../../../physics/sdof';
import { brent } from '../../../physics/roots';
import { useRaf } from '../../../anim/hooks';
import { Dot, HLine, Line, Plot, VLine, sample } from '../../../plot/Plot';
import { Badge, Button, Callout, Readout, Readouts, SimLayout, Slider, Toggle } from '../../../ui/kit';
import { PredictReveal } from '../../../ui/PredictReveal';
import { completeChallenge, useProgress } from '../../../app/store';
import { Rich } from '../../../ui/Rich';

const I = 12; // kg m² about the hinge
const K = 30; // N m/rad
const TH0 = 90; // degrees open
const CLOSED_BAND = 1; // degrees: "closed" once within 1° and staying there
const SLAM = 0.5; // degrees of overshoot you could see or hear
const DEG = Math.PI / 180;
export const DOOR_CHALLENGE = 'a1-door-closer';

/**
 * One definition for every ζ: the time after which the door stays within 1° of closed.
 * Continuous in ζ (under-damped included), Infinity if it never settles (ζ = 0).
 */
export function closeTime(wn: number, zeta: number): number {
  const th = (t: number) => freeResponse(t, TH0, 0, wn, zeta);
  if (zeta >= 1) {
    const f = (t: number) => th(t) - CLOSED_BAND;
    return f(120) > 0 ? Infinity : brent(f, 0, 120);
  }
  if (zeta <= 0) return Infinity;
  // |θ| is bounded by the envelope θ0 e^(−ζωn t)/√(1−ζ²); search back from where it drops below the band.
  const tEnv = Math.log(TH0 / (CLOSED_BAND * Math.sqrt(1 - zeta * zeta))) / (zeta * wn);
  if (!(tEnv < 600)) return Infinity;
  const dt = Math.max(1e-3, tEnv / 4000);
  const g = (t: number) => Math.abs(th(t)) - CLOSED_BAND;
  for (let t = tEnv; t > 0; t -= dt) {
    if (g(t) >= 0) {
      const r = brent(g, t, Math.min(t + dt, tEnv));
      return Number.isFinite(r) ? r : t;
    }
  }
  return 0;
}

/** For zeta < 1: first time the door reaches the frame (θ = 0) and the first overshoot past it. */
function firstContact(wn: number, zeta: number) {
  const wd = wn * Math.sqrt(1 - zeta * zeta);
  const t1 = (Math.PI - Math.atan2(wd, zeta * wn)) / wd;
  const speed = Math.abs((wn / Math.sqrt(1 - zeta * zeta)) * TH0 * Math.exp(-zeta * wn * t1) * Math.sin(wd * t1));
  const overshoot = TH0 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
  return { t1, speed, overshoot };
}

export default function DoorCloser() {
  const p = useProgress();
  const wn = naturalFrequency(K, I);
  const cc = criticalDamping(K, I);
  const [c, setC] = useState(0.45 * cc);
  const [showCrit, setShowCrit] = useState(false);
  const zeta = dampingRatio(c, K, I);
  const tCrit = useMemo(() => closeTime(wn, 1), [wn]);
  // Within 1e-4 of critical counts as critical (overshoot ~e^-222): typed, rounded values must not "fail".
  const under = zeta < 1 - 1e-4;
  const contact = under && zeta > 0 ? firstContact(wn, zeta) : under ? { t1: Math.PI / (2 * wn), speed: (wn * TH0), overshoot: TH0 } : null;
  const tClose = closeTime(wn, zeta);
  const slams = under && contact!.overshoot >= SLAM;
  const solved = !under && tClose <= 1.05 * tCrit;
  const done = !!p.challenges[DOOR_CHALLENGE];

  const curve = useMemo(() => sample((t) => freeResponse(t, TH0, 0, wn, zeta), 0, 12, 400), [wn, zeta]);
  const crit = useMemo(() => sample((t) => freeResponse(t, TH0, 0, wn, 1), 0, 12, 300), [wn]);

  // Release animation (real time). θ is clamped at 0: the frame stops the door.
  const anim = useRef({ t: 0, playing: false });
  const doorRef = useRef<SVGLineElement>(null);
  const flashRef = useRef<SVGTextElement>(null);
  const [tNow, setTNow] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useRaf(
    (dt) => {
      const a = anim.current;
      if (!a.playing) return;
      a.t += dt;
      let th = freeResponse(a.t, TH0, 0, wn, zeta);
      const hit = slams && a.t >= contact!.t1;
      if (hit) th = 0;
      const ang = th * DEG;
      doorRef.current?.setAttribute('x2', String(60 + 210 * Math.cos(ang)));
      doorRef.current?.setAttribute('y2', String(200 - 210 * Math.sin(ang)));
      flashRef.current?.setAttribute('opacity', hit ? '1' : '0');
      if (Math.round(a.t * 20) !== Math.round((a.t - dt) * 20)) setTNow(a.t);
      if (a.t > Math.min(12, (Number.isFinite(tClose) ? tClose : 12) + 1.5)) a.playing = false;
    },
    true,
    wrapRef
  );
  const release = () => {
    anim.current = { t: 0, playing: true };
    doorRef.current?.setAttribute('x2', '60');
    doorRef.current?.setAttribute('y2', '-10');
  };

  const check = () => {
    if (solved) completeChallenge(DOOR_CHALLENGE);
  };

  return (
    <div ref={wrapRef}>
      <Callout kind="info" title="Challenge">
        <Rich
          text={`A door ($I$ = ${I} kg m² about the hinge) has a closing spring $k_t$ = ${K} N m/rad. Choose the damper coefficient $c$ so that, released from ${TH0}° open, it shuts **as fast as possible without ever swinging past the closed position** (no slam).`}
        />
      </Callout>
      <SimLayout
        visual={
          <>
            <svg viewBox="0 0 360 225" className="anim" style={{ maxWidth: 420 }} role="img" aria-label="Top view of the door swinging shut">
              <line x1={60} y1={200} x2={330} y2={200} stroke="var(--text-3)" strokeWidth={6} strokeLinecap="round" />
              <text x={335} y={218} textAnchor="end" className="plot-note">
                frame (closed)
              </text>
              <path d="M60 200 m210 0 A210 210 0 0 0 60 -10" fill="none" stroke="var(--border)" strokeDasharray="4 4" />
              <line ref={doorRef} x1={60} y1={200} x2={60} y2={-10} stroke="var(--m1)" strokeWidth={7} strokeLinecap="round" />
              <circle cx={60} cy={200} r={7} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={2} />
              <text ref={flashRef} x={210} y={180} textAnchor="middle" fill="var(--bad)" fontWeight={700} opacity={0}>
                SLAM!
              </text>
            </svg>
            <Plot x={{ min: 0, max: 12, label: 'time (s)' }} y={{ min: -40, max: 95, label: 'door angle θ (°)' }} height={220} ariaLabel="Door angle against time">
              <HLine y={0} dash={false} label="closed" color="var(--text-2)" />
              {showCrit && <Line points={crit} color="var(--ok)" dash width={1.8} />}
              <Line points={curve} color="var(--m1)" width={2.4} />
              {slams && <Dot x={contact!.t1} y={0} color="var(--bad)" label="hits frame" />}
              {Number.isFinite(tClose) && tClose <= 12 && <VLine x={tClose} color="var(--m1)" label="within 1° for good" />}
              {tNow !== null && <VLine x={tNow} color="var(--text-3)" dash={false} width={1} />}
            </Plot>
          </>
        }
        controls={
          <>
            <Slider label="damper" tex="c" tip="damping coefficient (N m s/rad)" value={c} min={0} max={2 * cc} step={cc / 400} unit="N m s/rad" sig={4} onChange={setC} />
            <Readouts>
              <Readout tex="\omega_n" tip="√(k_t/I)" value={wn} unit="rad/s" />
              <Readout tex="\zeta" tip="c / (2√(k_t I))" value={zeta} sig={3} tone={solved ? 'ok' : under ? 'bad' : 'm2'} />
              <Readout label="closed (within 1°) after" value={tClose} unit="s" sig={3} text={Number.isFinite(tClose) ? undefined : 'never (undamped)'} tip="time after which the door stays within 1° of closed" />
              <Readout
                label="overshoot past closed"
                value={under ? contact!.overshoot : 0}
                unit="°"
                sig={2}
                tone={slams ? 'bad' : under ? 'warn' : 'ok'}
                text={under && contact!.overshoot < 1e-3 ? '< 0.001 °' : undefined}
                tip="how far the door would swing past the closed position"
              />
            </Readouts>
            {slams ? (
              <Callout kind="bad" title="It slams">
                With ζ = {zeta.toFixed(2)} the door reaches the frame at {contact!.t1.toFixed(2)} s still moving at {contact!.speed.toFixed(1)} °/s and would swing {contact!.overshoot.toPrecision(2)}° past it.
              </Callout>
            ) : under ? (
              <Callout kind="warn" title="Tiny overshoot, so not the answer">
                <Rich
                  text={`ζ = ${zeta.toFixed(3)} < 1, so the door still crosses the closed position, by ${contact!.overshoot < 1e-3 ? 'less than 0.001°' : `${contact!.overshoot.toPrecision(2)}°`}: far too little to see. It is within 1° of closed after ${tClose.toFixed(2)} s, which is why real closers are often set slightly under-damped. The answer to "fastest **without** overshoot" is critical damping, $c = 2\\sqrt{k_t I}$.`}
                />
              </Callout>
            ) : solved ? (
              <Callout kind="ok" title="Fastest without overshoot">
                <Rich text={`ζ = ${zeta.toFixed(3)}. Critical damping, $c_c = 2\\sqrt{k_t I}$ = ${cc.toFixed(2)} N m s/rad, is the fastest return that never crosses closed.`} />
              </Callout>
            ) : (
              <Callout kind="warn" title="Safe but slow">
                Over-damped (ζ = {zeta.toFixed(2)}): it creeps shut in {tClose.toFixed(2)} s vs {tCrit.toFixed(2)} s at the best setting.
              </Callout>
            )}
            <div className="row gap-s wrap">
              <Button variant="primary" onClick={release}>
                Release the door
              </Button>
              <Button onClick={check} disabled={!solved || done}>
                {done ? '✓ Challenge complete' : 'Submit this setting'}
              </Button>
            </div>
            <Toggle checked={showCrit} onChange={setShowCrit} label="Show the critically damped curve" />
            {done && <Badge tone="ok">Solved. Practical note: real dampers drift, so engineers set c slightly above c_c.</Badge>}
          </>
        }
      />
      <PredictReveal
        id="a1-door-half"
        question="From the critical setting, you **halve** $c$. What happens?"
        options={['It shuts faster and stays shut', 'It reaches the frame sooner but hits it while still moving', 'It shuts more slowly']}
        answer={1}
        explain="Halving $c$ gives $\zeta = 0.5$: the door reaches θ = 0 sooner, but with speed left over, so it slams (overshoot $e^{-\pi\zeta/\sqrt{1-\zeta^2}}$ = 16 % of the opening). Any ζ < 1 crosses zero."
        tryIt="set c to about half of c_c and release."
        onApply={() => setC(0.5 * cc)}
      />
      <PredictReveal
        id="a1-door-angle"
        question="Does the best damper setting depend on how far the door is opened ($\theta_0$)?"
        options={['Yes: a wider opening needs more damping', 'No: the system is linear, so ζ = 1 is best for any opening']}
        answer={1}
        explain="The response scales with $\theta_0$ but its shape depends only on $\omega_n$ and $\zeta$. Critical damping, $c = 2\sqrt{kI}$, is optimal for every opening angle (2021 A1.1)."
      />
    </div>
  );
}

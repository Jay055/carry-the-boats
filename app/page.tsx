"use client";

import { useEffect, useMemo, useState, type ButtonHTMLAttributes } from "react";
import {
  allEquipment,
  defaultEquipment,
  exampleWeek,
  mealIdeas,
  principles,
  science,
  sessions,
  weeklyDirectSets,
  type Equipment,
  type Exercise,
  type Session
} from "../lib/program";

type SetLog = { weight: string; reps: string; rir: string; done: boolean };
type Workout = {
  id: string;
  date: string;
  sessionId: Session["id"];
  sets: Record<string, SetLog[]>;
  notes: string;
  completed: boolean;
  durationMin?: number;
};
type BodyEntry = { date: string; weight: number; waist?: number };
type AppStore = { workouts: Workout[]; body: BodyEntry[]; equipment: Equipment[] };
type Tab = "workout" | "history" | "progress" | "program";

const STORAGE_KEY = "carry-the-boats-v6";
const LEGACY_KEYS = ["carry-the-boats-v5", "carry-the-boats-v4"];

function isoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function nextCoreId(id: "A" | "B" | "C") {
  return id === "A" ? "B" : id === "B" ? "C" : "A";
}

function weekStart() {
  const d = new Date();
  const weekday = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - weekday);
  return d;
}

function emptyWorkout(session: Session): Workout {
  const sets: Record<string, SetLog[]> = {};
  for (const exercise of session.exercises) {
    sets[exercise.id] = Array.from({ length: exercise.sets }, () => ({
      weight: "",
      reps: "",
      rir: "",
      done: false
    }));
  }
  return {
    id: isoDate() + "-" + session.id + "-" + Date.now(),
    date: isoDate(),
    sessionId: session.id,
    sets,
    notes: "",
    completed: false
  };
}

function secsToClock(value: number) {
  const min = Math.floor(value / 60);
  const sec = String(value % 60).padStart(2, "0");
  return min + ":" + sec;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
}

function lastDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (count - 1 - index));
    return {
      date: isoDate(d),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
      day: d.getDate()
    };
  });
}

function workoutVolume(workout: Workout) {
  return Object.values(workout.sets)
    .flat()
    .filter((set) => set.done)
    .reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
}

function completedSetCount(workout: Workout) {
  return Object.values(workout.sets).flat().filter((set) => set.done).length;
}

function latestExerciseLogs(workouts: Workout[]) {
  const result: Record<string, SetLog[]> = {};
  for (const workout of [...workouts].reverse()) {
    if (!workout.completed) continue;
    for (const [exerciseId, sets] of Object.entries(workout.sets)) {
      if (!result[exerciseId]) result[exerciseId] = sets;
    }
  }
  return result;
}

function progressionAdvice(exercise: Exercise, previous?: SetLog[]) {
  const done = (previous || []).filter((set) => set.done && Number(set.reps) > 0);
  if (!done.length) {
    return "Start conservative. Finish with the planned reps in reserve and establish a clean baseline.";
  }
  const reps = done.map((set) => Number(set.reps));
  const min = Math.min(...reps);
  const weights = done.map((set) => Number(set.weight)).filter((n) => Number.isFinite(n) && n > 0);
  const sameWeight = weights.length > 0 && weights.every((w) => w === weights[0]);
  const targetRir = Number(exercise.rir.match(/\d+/)?.[0] || 0);
  const actualRirs = done.map((set) => Number(set.rir)).filter((n) => Number.isFinite(n) && n >= 0);
  const rirReady = actualRirs.length < done.length || Math.min(...actualRirs) >= targetRir;

  if (sameWeight && min >= exercise.maxRep && !rirReady) {
    return "Repeat this load. You hit the reps, but first own them at the planned effort.";
  }
  if (sameWeight && min >= exercise.maxRep && rirReady) {
    return "Progress next time: add about " + exercise.loadStep + " kg and rebuild inside " + exercise.reps + ".";
  }
  if (min >= exercise.minRep) {
    return "Keep the load and add reps until every work set reaches " + exercise.maxRep + ".";
  }
  return "Hold or reduce the load slightly so all work sets land inside the rep range with clean technique.";
}

function equipmentMatch(exercise: Exercise, available: Equipment[]) {
  return exercise.equipment.some((item) => available.includes(item));
}

type MotionKind =
  | "press"
  | "pulldown"
  | "row"
  | "lateral"
  | "reverse-fly"
  | "shrug"
  | "leg-press"
  | "leg-curl"
  | "hip-thrust"
  | "leg-extension"
  | "calf"
  | "curl"
  | "pushdown";

function motionKind(exercise: Exercise): MotionKind {
  if (exercise.id === "press" || exercise.id === "incline" || exercise.id === "inclineC") return "press";
  if (exercise.id === "pulldown" || exercise.id === "singlelat") return "pulldown";
  if (exercise.id === "row" || exercise.id === "rowC") return "row";
  if (exercise.id === "cable-lateral-raise") return "lateral";
  if (exercise.id === "reverse-pec-deck") return "reverse-fly";
  if (exercise.id === "shrug") return "shrug";
  if (exercise.id === "leg-press") return "leg-press";
  if (exercise.id === "seated-leg-curl") return "leg-curl";
  if (exercise.id === "hip") return "hip-thrust";
  if (exercise.id === "leg-extension") return "leg-extension";
  if (exercise.id === "calf") return "calf";
  if (exercise.id === "biceps") return "curl";
  return "pushdown";
}

function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, className = "", ...rest } = props;
  return (
    <button className={"button " + className} {...rest}>
      {children}
    </button>
  );
}

function ExerciseAnimation({
  exercise,
  size = "normal",
  paused = false
}: {
  exercise: Exercise;
  size?: "small" | "normal" | "large";
  paused?: boolean;
}) {
  const kind = motionKind(exercise);
  return (
    <div
      className={"exercise-motion " + size + " motion-" + kind + (paused ? " paused" : "")}
      role="img"
      aria-label={"Animated demonstration of " + exercise.name}
    >
      <svg viewBox="0 0 120 100" aria-hidden="true">
        <line className="motion-ground" x1="12" y1="87" x2="108" y2="87" />
        <g className="motion-person">
          <circle className="motion-head" cx="60" cy="24" r="7" />
          <line className="motion-torso" x1="60" y1="31" x2="60" y2="60" />
          <g className="motion-arms">
            <line className="motion-arm left" x1="60" y1="37" x2="44" y2="51" />
            <line className="motion-arm right" x1="60" y1="37" x2="76" y2="51" />
            <circle className="motion-weight weight-left" cx="43" cy="52" r="3" />
            <circle className="motion-weight weight-right" cx="77" cy="52" r="3" />
          </g>
          <g className="motion-forearms">
            <line className="motion-forearm left" x1="44" y1="51" x2="45" y2="66" />
            <line className="motion-forearm right" x1="76" y1="51" x2="75" y2="66" />
          </g>
          <g className="motion-legs">
            <line className="motion-thigh left" x1="60" y1="60" x2="48" y2="74" />
            <line className="motion-thigh right" x1="60" y1="60" x2="72" y2="74" />
            <g className="motion-lower-legs">
              <line className="motion-shin left" x1="48" y1="74" x2="47" y2="87" />
              <line className="motion-shin right" x1="72" y1="74" x2="73" y2="87" />
            </g>
          </g>
        </g>

        <g className="motion-equipment">
          <line className="cable-post" x1="98" y1="12" x2="98" y2="86" />
          <line className="cable-line" x1="98" y1="20" x2="78" y2="44" />
          <rect className="bench-shape" x="35" y="66" width="50" height="8" rx="3" />
          <rect className="sled-shape" x="82" y="45" width="20" height="32" rx="4" />
          <line className="machine-pad" x1="82" y1="62" x2="101" y2="62" />
        </g>

        <path className="motion-arrow arrow-up" d="M103 69 L103 38 M98 43 L103 38 L108 43" />
        <path className="motion-arrow arrow-out" d="M60 70 L88 70 M83 65 L88 70 L83 75" />
      </svg>
    </div>
  );
}

function ExerciseThumb({ exercise, size = "normal" }: { exercise: Exercise; size?: "small" | "normal" | "large" }) {
  return <ExerciseAnimation exercise={exercise} size={size} />;
}

function NavIcon({ type }: { type: Tab }) {
  if (type === "workout") {
    return <svg viewBox="0 0 24 24"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></svg>;
  }
  if (type === "history") {
    return <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" /></svg>;
  }
  if (type === "progress") {
    return <svg viewBox="0 0 24 24"><path d="M4 18l5-6 4 3 7-9M18 6h2v2" /></svg>;
  }
  return <svg viewBox="0 0 24 24"><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" /></svg>;
}

function MiniChart({ values }: { values: number[] }) {
  if (!values.length) return <div className="empty-chart">Log workouts to build this graph</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 90 - ((value - min) / spread) * 70;
      return x + "," + y;
    })
    .join(" ");
  return (
    <svg className="mini-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Progress chart">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(91,124,255,.34)" />
          <stop offset="100%" stopColor="rgba(91,124,255,0)" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("workout");
  const [store, setStore] = useState<AppStore>({ workouts: [], body: [], equipment: defaultEquipment });
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Session["id"]>("A");
  const [previewSessionId, setPreviewSessionId] = useState<Session["id"] | null>(null);
  const [active, setActive] = useState<Workout | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [timer, setTimer] = useState(0);
  const [timerLabel, setTimerLabel] = useState("Rest");
  const [demoExercise, setDemoExercise] = useState<Exercise | null>(null);
  const [bodyWeight, setBodyWeight] = useState("");
  const [waist, setWaist] = useState("");

  useEffect(() => {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        for (const key of LEGACY_KEYS) {
          raw = localStorage.getItem(key);
          if (raw) break;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppStore>;
        const parsedWorkouts = parsed.workouts || [];
        setStore({
          workouts: parsedWorkouts,
          body: parsed.body || [],
          equipment: parsed.equipment && parsed.equipment.length ? parsed.equipment : defaultEquipment
        });
        const lastCore = [...parsedWorkouts].reverse().find((workout) => workout.completed && workout.sessionId !== "D");
        if (lastCore && (lastCore.sessionId === "A" || lastCore.sessionId === "B" || lastCore.sessionId === "C")) {
          setSelected(nextCoreId(lastCore.sessionId));
        }
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [ready, store]);

  useEffect(() => {
    if (!active || !startedAt) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);

  useEffect(() => {
    if (timer <= 0) return;
    const id = window.setInterval(() => setTimer((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const previous = useMemo(() => latestExerciseLogs(store.workouts), [store.workouts]);
  const dayStrip = useMemo(() => lastDays(14), []);
  const chosenSession = sessions.find((session) => session.id === selected) || sessions[0];
  const previewSession = sessions.find((session) => session.id === previewSessionId) || null;
  const completedThisWeek = store.workouts.filter(
    (workout) => workout.completed && new Date(workout.date + "T12:00:00").getTime() >= weekStart().getTime()
  );
  const requiredThisWeek = new Set(
    completedThisWeek.filter((workout) => workout.sessionId !== "D").map((workout) => workout.sessionId)
  ).size;
  const latestBody = store.body.length ? store.body[store.body.length - 1] : undefined;
  const totalSets = active ? completedSetCount(active) : 0;
  const totalVolume = active ? workoutVolume(active) : 0;
  const elapsedSeconds = active && startedAt ? Math.max(0, Math.floor((clock - startedAt) / 1000)) : 0;

  const workoutsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const workout of store.workouts) {
      if (!workout.completed) continue;
      if (!map[workout.date]) map[workout.date] = [];
      map[workout.date].push(workout.sessionId);
    }
    return map;
  }, [store.workouts]);

  const uniqueExercises = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const session of sessions) {
      for (const exercise of session.exercises) {
        const current = map.get(exercise.id);
        if (!current || (!current.videoUrl && exercise.videoUrl)) map.set(exercise.id, exercise);
      }
    }
    return [...map.values()];
  }, []);

  const progressSeries = useMemo(() => {
    const ids = ["press", "leg-press", "pulldown", "cable-lateral-raise"];
    const labels: Record<string, string> = {
      press: "Shoulder press",
      "leg-press": "Leg press",
      pulldown: "Lat pulldown",
      "cable-lateral-raise": "Lateral raise"
    };
    return ids.map((exerciseId) => {
      const values: number[] = [];
      for (const workout of store.workouts) {
        if (!workout.completed) continue;
        const best = (workout.sets[exerciseId] || [])
          .filter((set) => set.done && Number(set.weight) > 0)
          .reduce((max, set) => Math.max(max, Number(set.weight)), 0);
        if (best > 0) values.push(best);
      }
      return { exerciseId, label: labels[exerciseId], values: values.slice(-8) };
    });
  }, [store.workouts]);

  function startWorkout(session: Session) {
    setSelected(session.id);
    setActive(emptyWorkout(session));
    setStartedAt(Date.now());
    setClock(Date.now());
    setPreviewSessionId(null);
    setTab("workout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateSet(exerciseId: string, index: number, patch: Partial<SetLog>) {
    setActive((current) => {
      if (!current) return current;
      const nextSets = current.sets[exerciseId].map((set, setIndex) =>
        setIndex === index ? { ...set, ...patch } : set
      );
      return { ...current, sets: { ...current.sets, [exerciseId]: nextSets } };
    });
  }

  function addSet(exerciseId: string) {
    setActive((current) => {
      if (!current) return current;
      const next = [...(current.sets[exerciseId] || []), { weight: "", reps: "", rir: "", done: false }];
      return { ...current, sets: { ...current.sets, [exerciseId]: next } };
    });
  }

  function removeLastSet(exerciseId: string) {
    setActive((current) => {
      if (!current || (current.sets[exerciseId] || []).length <= 1) return current;
      return {
        ...current,
        sets: {
          ...current.sets,
          [exerciseId]: current.sets[exerciseId].slice(0, -1)
        }
      };
    });
  }

  function completeSet(exercise: Exercise, index: number) {
    if (!active) return;
    const set = active.sets[exercise.id][index];
    const nextDone = !set.done;
    updateSet(exercise.id, index, { done: nextDone });
    if (nextDone) {
      setTimer(exercise.restSec);
      setTimerLabel(exercise.name);
    }
  }

  function finishWorkout() {
    if (!active) return;
    const elapsed = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : undefined;
    const saved = { ...active, completed: true, durationMin: elapsed };
    setStore((current) => ({
      ...current,
      workouts: [...current.workouts.filter((workout) => workout.id !== saved.id), saved]
    }));
    if (active.sessionId === "A" || active.sessionId === "B" || active.sessionId === "C") {
      setSelected(nextCoreId(active.sessionId));
    } else {
      const lastCore = [...store.workouts].reverse().find((workout) => workout.completed && workout.sessionId !== "D");
      if (lastCore && (lastCore.sessionId === "A" || lastCore.sessionId === "B" || lastCore.sessionId === "C")) {
        setSelected(nextCoreId(lastCore.sessionId));
      }
    }
    setActive(null);
    setStartedAt(null);
    setTimer(0);
    setTab("history");
  }

  function saveBody() {
    const value = Number(bodyWeight);
    if (!Number.isFinite(value) || value <= 0) return;
    const waistValue = Number(waist);
    const entry: BodyEntry = {
      date: isoDate(),
      weight: value,
      ...(Number.isFinite(waistValue) && waistValue > 0 ? { waist: waistValue } : {})
    };
    setStore((current) => ({ ...current, body: [...current.body, entry] }));
    setBodyWeight("");
    setWaist("");
  }

  function toggleEquipment(item: Equipment) {
    setStore((current) => {
      const has = current.equipment.includes(item);
      return {
        ...current,
        equipment: has
          ? current.equipment.filter((value) => value !== item)
          : [...current.equipment, item]
      };
    });
  }

  function deleteWorkout(id: string) {
    if (!window.confirm("Delete this logged workout?")) return;
    setStore((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== id)
    }));
  }

  function openDemo(exercise: Exercise) {
    setDemoExercise(exercise);
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="loading-logo">CTB</div>
        <span>Loading workouts…</span>
      </main>
    );
  }

  if (active) {
    const activeSession = sessions.find((session) => session.id === active.sessionId) || sessions[0];
    return (
      <main className="hevy-app live-app">
        <header className="live-header">
          <button
            className="text-button"
            onClick={() => {
              if (totalSets === 0 || window.confirm("Discard this unfinished workout?")) {
                setActive(null);
                setStartedAt(null);
                setTimer(0);
              }
            }}
          >
            Cancel
          </button>
          <div className="live-title">
            <strong>{activeSession.title}</strong>
            <span>{formatDuration(elapsedSeconds)}</span>
          </div>
          <Button className="finish-button" disabled={totalSets === 0} onClick={finishWorkout}>
            Finish
          </Button>
        </header>

        <section className="live-summary">
          <div><strong>{formatDuration(elapsedSeconds)}</strong><span>Duration</span></div>
          <div><strong>{totalVolume.toLocaleString()} kg</strong><span>Volume</span></div>
          <div><strong>{totalSets}</strong><span>Sets</span></div>
        </section>

        {active.sessionId === "D" ? (
          <div className="workout-alert">
            <strong>Optional volume</strong>
            <span>Keep this easy enough that it never compromises your next core workout or boxing recovery.</span>
          </div>
        ) : null}

        <section className="live-exercises">
          {activeSession.exercises.map((exercise) => {
            const prev = previous[exercise.id];
            const available = equipmentMatch(exercise, store.equipment);
            return (
              <article className="live-exercise" key={exercise.id}>
                <div className="exercise-header">
                  <button className="thumb-button" onClick={() => openDemo(exercise)} aria-label={"View " + exercise.name + " demo"}>
                    <ExerciseThumb exercise={exercise} />
                    <span className="play-badge">▶</span>
                  </button>
                  <div className="exercise-heading-copy">
                    <h2>{exercise.name}</h2>
                    <button className="exercise-link" onClick={() => openDemo(exercise)}>
                      {exercise.target} · View exercise
                    </button>
                  </div>
                  <button className="more-button" onClick={() => openDemo(exercise)} aria-label="Exercise options">•••</button>
                </div>

                <div className="routine-note">
                  <span>Coach</span>
                  <p>{exercise.cue}</p>
                </div>

                <div className="progression-callout">
                  <strong>Next target</strong>
                  <span>{progressionAdvice(exercise, prev)}</span>
                </div>

                {!available ? (
                  <div className="swap-callout">
                    <strong>Equipment not selected</strong>
                    <span>{exercise.alternatives.slice(0, 3).join(" · ")}</span>
                  </div>
                ) : null}

                <div className="sets-grid set-labels">
                  <span>SET</span>
                  <span>PREVIOUS</span>
                  <span>KG</span>
                  <span>REPS</span>
                  <span>RIR</span>
                  <span />
                </div>

                {(active.sets[exercise.id] || []).map((set, index) => {
                  const old = prev?.[index];
                  const oldText = old?.weight
                    ? old.weight + " × " + (old.reps || "–")
                    : old?.reps
                      ? old.reps + " reps"
                      : "—";
                  return (
                    <div className={set.done ? "sets-grid set-line is-done" : "sets-grid set-line"} key={index}>
                      <button className="set-type">{index + 1}</button>
                      <span className="previous-value">{oldText}</span>
                      <input
                        inputMode="decimal"
                        value={set.weight}
                        placeholder={old?.weight || "0"}
                        onChange={(event) => updateSet(exercise.id, index, { weight: event.target.value })}
                        aria-label={exercise.name + " set " + (index + 1) + " weight"}
                      />
                      <input
                        inputMode="numeric"
                        value={set.reps}
                        placeholder={old?.reps || String(exercise.minRep)}
                        onChange={(event) => updateSet(exercise.id, index, { reps: event.target.value })}
                        aria-label={exercise.name + " set " + (index + 1) + " reps"}
                      />
                      <input
                        inputMode="numeric"
                        value={set.rir}
                        placeholder="2"
                        onChange={(event) => updateSet(exercise.id, index, { rir: event.target.value })}
                        aria-label={exercise.name + " set " + (index + 1) + " reps in reserve"}
                      />
                      <button
                        className={set.done ? "set-check checked" : "set-check"}
                        onClick={() => completeSet(exercise, index)}
                        aria-label={"Complete " + exercise.name + " set " + (index + 1)}
                      >
                        ✓
                      </button>
                    </div>
                  );
                })}

                <div className="set-actions">
                  <button onClick={() => addSet(exercise.id)}>+ Add set</button>
                  {(active.sets[exercise.id] || []).length > 1 ? (
                    <button className="secondary-set-action" onClick={() => removeLastSet(exercise.id)}>Remove last</button>
                  ) : null}
                </div>

                <details className="exercise-details">
                  <summary>Alternatives & why</summary>
                  <p>{exercise.why}</p>
                  <strong>Swap with:</strong>
                  <p>{exercise.alternatives.join(" · ")}</p>
                  <small>Use a swap that preserves the target muscle while reducing unavailable equipment, balance demand, or joint irritation.</small>
                </details>
              </article>
            );
          })}
        </section>

        <section className="workout-notes-card">
          <label htmlFor="workout-notes">Workout notes</label>
          <textarea
            id="workout-notes"
            value={active.notes}
            onChange={(event) => setActive((current) => current ? { ...current, notes: event.target.value } : current)}
            placeholder="Energy, pain, setup changes, wins…"
          />
        </section>

        <div className="live-finish-zone">
          <Button className="large-finish" disabled={totalSets === 0} onClick={finishWorkout}>
            Finish workout
          </Button>
        </div>

        {timer > 0 ? (
          <aside className="rest-bar">
            <button onClick={() => setTimer(Math.max(0, timer - 15))}>−15</button>
            <div>
              <span>{timerLabel}</span>
              <strong>{secsToClock(timer)}</strong>
            </div>
            <button onClick={() => setTimer(timer + 15)}>+15</button>
            <button className="skip-rest" onClick={() => setTimer(0)}>Skip</button>
          </aside>
        ) : null}

        {demoExercise ? (
          <div className="modal-backdrop" onClick={() => setDemoExercise(null)}>
            <div className="demo-modal" onClick={(event) => event.stopPropagation()}>
              <div className="modal-head">
                <div>
                  <strong>{demoExercise.name}</strong>
                  <span>{demoExercise.target}</span>
                </div>
                <button onClick={() => setDemoExercise(null)}>✕</button>
              </div>
              <div className="animation-stage">
                <ExerciseAnimation exercise={demoExercise} size="large" />
              </div>
            <div className="demo-info">
              <span>Technique</span>
              <p>{demoExercise.cue}</p>
              <span>Why it is here</span>
              <p>{demoExercise.why}</p>
            </div>
            <div className="guide-link static-guide">Built-in looping movement guide</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

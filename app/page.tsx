"use client";

import { useEffect, useMemo, useState, type ButtonHTMLAttributes } from "react";
import {
  allEquipment,
  defaultEquipment,
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
type Tab = "train" | "progress" | "plan" | "guide" | "settings";

const STORAGE_KEY = "carry-the-boats-v4";

function isoDate() {
  return new Date().toISOString().slice(0, 10);
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

function lastDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (count - 1 - index));
    return {
      date: d.toISOString().slice(0, 10),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
      day: d.getDate()
    };
  });
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
    return "First exposure: choose a conservative load and leave the planned reps in reserve.";
  }
  const reps = done.map((set) => Number(set.reps));
  const min = Math.min(...reps);
  const weights = done
    .map((set) => Number(set.weight))
    .filter((n) => Number.isFinite(n) && n > 0);
  const sameWeight = weights.length > 0 && weights.every((w) => w === weights[0]);

  if (sameWeight && min >= exercise.maxRep) {
    return "Progress: add about " + exercise.loadStep + " kg next time, then rebuild within " + exercise.reps + ".";
  }
  if (min >= exercise.minRep) {
    return "Progress: keep the load and add reps until all working sets reach " + exercise.maxRep + ".";
  }
  return "Hold or slightly reduce the load so every working set lands inside the target range with clean technique.";
}

function equipmentMatch(exercise: Exercise, available: Equipment[]) {
  return exercise.equipment.some((item) => available.includes(item));
}

function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, className = "", ...rest } = props;
  return (
    <button className={"button " + className} {...rest}>
      {children}
    </button>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("train");
  const [store, setStore] = useState<AppStore>({
    workouts: [],
    body: [],
    equipment: defaultEquipment
  });
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Session["id"]>("A");
  const [active, setActive] = useState<Workout | null>(null);
  const [timer, setTimer] = useState(0);
  const [timerLabel, setTimerLabel] = useState("Rest");
  const [videoOpen, setVideoOpen] = useState<string | null>(null);
  const [bodyWeight, setBodyWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppStore>;
        const parsedWorkouts = parsed.workouts || [];
        setStore({
          workouts: parsedWorkouts,
          body: parsed.body || [],
          equipment: parsed.equipment && parsed.equipment.length ? parsed.equipment : defaultEquipment
        });
        const lastCore = [...parsedWorkouts]
          .reverse()
          .find((workout) => workout.completed && workout.sessionId !== "D");
        if (lastCore) {
          const nextCore: Record<"A" | "B" | "C", "A" | "B" | "C"> = {
            A: "B",
            B: "C",
            C: "A"
          };
          if (lastCore.sessionId === "A" || lastCore.sessionId === "B" || lastCore.sessionId === "C") {
            setSelected(nextCore[lastCore.sessionId]);
          }
        }
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [ready, store]);

  useEffect(() => {
    if (timer <= 0) return;
    const id = window.setInterval(() => {
      setTimer((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const previous = useMemo(() => latestExerciseLogs(store.workouts), [store.workouts]);
  const dayStrip = useMemo(() => lastDays(14), []);
  const workoutsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const workout of store.workouts) {
      if (!workout.completed) continue;
      if (!map[workout.date]) map[workout.date] = [];
      map[workout.date].push(workout.sessionId);
    }
    return map;
  }, [store.workouts]);
  const chosenSession = sessions.find((session) => session.id === selected) || sessions[0];
  const completedThisWeek = store.workouts.filter(
    (workout) =>
      workout.completed &&
      new Date(workout.date + "T12:00:00").getTime() >= weekStart().getTime()
  );
  const requiredThisWeek = new Set(
    completedThisWeek.filter((w) => w.sessionId !== "D").map((w) => w.sessionId)
  ).size;
  const latestBody = store.body.length ? store.body[store.body.length - 1] : undefined;
  const totalSets = active
    ? Object.values(active.sets).flat().filter((set) => set.done).length
    : 0;

  function startWorkout(session: Session) {
    setSelected(session.id);
    setActive(emptyWorkout(session));
    setStartedAt(Date.now());
    setTab("train");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateSet(exerciseId: string, index: number, patch: Partial<SetLog>) {
    setActive((current) => {
      if (!current) return current;
      const nextSets = current.sets[exerciseId].map((set, i) =>
        i === index ? { ...set, ...patch } : set
      );
      return { ...current, sets: { ...current.sets, [exerciseId]: nextSets } };
    });
  }

  function completeSet(exercise: Exercise, index: number) {
    if (!active) return;
    const set = active.sets[exercise.id][index];
    const nextDone = !set.done;
    updateSet(exercise.id, index, { done: nextDone });
    if (nextDone) {
      setTimer(exercise.restSec);
      setTimerLabel(exercise.name + " rest");
    }
  }

  function finishWorkout() {
    if (!active) return;
    const elapsed = startedAt
      ? Math.max(1, Math.round((Date.now() - startedAt) / 60000))
      : undefined;
    const saved = { ...active, completed: true, durationMin: elapsed };
    setStore((current) => ({
      ...current,
      workouts: [...current.workouts.filter((w) => w.id !== saved.id), saved]
    }));
    if (active.sessionId === "A") setSelected("B");
    if (active.sessionId === "B") setSelected("C");
    if (active.sessionId === "C") setSelected("A");
    setActive(null);
    setStartedAt(null);
    setTimer(0);
    setTab("progress");
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
    setStore((current) => ({
      ...current,
      workouts: current.workouts.filter((workout) => workout.id !== id)
    }));
  }

  if (!ready) {
    return (
      <main className="loading">
        <div className="brand-mark">CTB</div>
        <p>Loading your training log…</p>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">CARRY THE BOATS</div>
          <h1>Build muscle. Get stronger. Track what matters.</h1>
        </div>
        <div className="week-pill">
          <strong>{requiredThisWeek}/3</strong>
          <span>core sessions</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Main navigation">
        {([
          ["train", "Train"],
          ["progress", "Progress"],
          ["plan", "Plan"],
          ["guide", "Guide"],
          ["settings", "Equipment"]
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {timer > 0 ? (
        <aside className="timer">
          <div>
            <span>{timerLabel}</span>
            <strong>{secsToClock(timer)}</strong>
          </div>
          <button onClick={() => setTimer(0)}>Skip</button>
        </aside>
      ) : null}

      <div className="shell">
        {tab === "train" && active ? (
          <section className="workout-live">
            <div className="section-heading">
              <div>
                <div className="eyebrow">LIVE WORKOUT · SESSION {active.sessionId}</div>
                <h2>{sessions.find((s) => s.id === active.sessionId)?.title}</h2>
                <p>{totalSets} working sets logged. Previous performance is shown beside today.</p>
              </div>
              <Button className="ghost" onClick={() => setActive(null)}>Exit</Button>
            </div>

            {(sessions.find((s) => s.id === active.sessionId)?.exercises || []).map(
              (exercise, exerciseIndex) => {
                const prev = previous[exercise.id];
                const available = equipmentMatch(exercise, store.equipment);
                return (
                  <article className="exercise-card" key={exercise.id}>
                    <div className="exercise-top">
                      <div className="exercise-number">{exerciseIndex + 1}</div>
                      <div className="exercise-title">
                        <div className="exercise-title-row">
                          <h3>{exercise.name}</h3>
                          {exercise.priority ? <span className="priority">PRIORITY</span> : null}
                        </div>
                        <p>
                          {exercise.sets} × {exercise.reps} · {exercise.rir} · {secsToClock(exercise.restSec)} rest
                        </p>
                      </div>
                      <div className="media-actions">
                        {exercise.videoUrl ? (
                          <button
                            className="demo"
                            onClick={() => setVideoOpen(videoOpen === exercise.id ? null : exercise.id)}
                            title="Watch exercise video"
                          >
                            {videoOpen === exercise.id ? "✕ Close" : "▶ Video"}
                          </button>
                        ) : null}
                        <a
                          className="demo"
                          href={exercise.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open animated exercise guide"
                        >
                          ↗ Guide
                        </a>
                      </div>
                    </div>

                    {exercise.videoUrl && videoOpen === exercise.id ? (
                      <div className="inline-video">
                        <iframe
                          src={exercise.videoUrl}
                          title={exercise.name + " exercise demonstration"}
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : null}

                    <div className="exercise-info">
                      <div>
                        <span>Target</span>
                        <strong>{exercise.target}</strong>
                      </div>
                      <div>
                        <span>Why it is here</span>
                        <strong>{exercise.why}</strong>
                      </div>
                    </div>

                    <div className="coach-note">
                      <strong>Coach:</strong> {progressionAdvice(exercise, prev)}
                    </div>

                    {!available ? (
                      <div className="warning">
                        Equipment mismatch. Use: <strong>{exercise.alternatives.join(" · ")}</strong>
                      </div>
                    ) : null}

                    <div className="set-table">
                      <div className="set-head">
                        <span>Set</span>
                        <span>Previous</span>
                        <span>kg</span>
                        <span>Reps</span>
                        <span>RIR</span>
                        <span>Done</span>
                      </div>
                      {active.sets[exercise.id].map((set, index) => {
                        const old = prev?.[index];
                        const oldText = old && old.weight
                          ? old.weight + " × " + (old.reps || "–")
                          : old?.reps
                            ? old.reps + " reps"
                            : "—";
                        return (
                          <div className={set.done ? "set-row done" : "set-row"} key={index}>
                            <strong>{index + 1}</strong>
                            <span className="previous">{oldText}</span>
                            <input
                              inputMode="decimal"
                              aria-label={exercise.name + " set " + (index + 1) + " weight"}
                              value={set.weight}
                              placeholder={old?.weight || "kg"}
                              onChange={(e) => updateSet(exercise.id, index, { weight: e.target.value })}
                            />
                            <input
                              inputMode="numeric"
                              aria-label={exercise.name + " set " + (index + 1) + " reps"}
                              value={set.reps}
                              placeholder={old?.reps || String(exercise.minRep)}
                              onChange={(e) => updateSet(exercise.id, index, { reps: e.target.value })}
                            />
                            <input
                              inputMode="numeric"
                              aria-label={exercise.name + " set " + (index + 1) + " reps in reserve"}
                              value={set.rir}
                              placeholder="1–2"
                              onChange={(e) => updateSet(exercise.id, index, { rir: e.target.value })}
                            />
                            <button
                              className={set.done ? "check done" : "check"}
                              onClick={() => completeSet(exercise, index)}
                              aria-label={"Mark " + exercise.name + " set " + (index + 1) + " complete"}
                            >
                              {set.done ? "✓" : ""}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <details className="details">
                      <summary>Technique + alternatives</summary>
                      <p><strong>Technique cue:</strong> {exercise.cue}</p>
                      <p><strong>Alternatives:</strong> {exercise.alternatives.join(" · ")}</p>
                      <p><strong>Equipment:</strong> {exercise.equipment.join(" · ")}</p>
                    </details>
                  </article>
                );
              }
            )}

            <div className="finish-card">
              <label>
                Workout notes
                <textarea
                  value={active.notes}
                  placeholder="How did the session feel? Any exercise to adjust next time?"
                  onChange={(e) =>
                    setActive((current) =>
                      current ? { ...current, notes: e.target.value } : current
                    )
                  }
                />
              </label>
              <Button className="primary finish" onClick={finishWorkout}>
                Finish & save workout
              </Button>
            </div>
          </section>
        ) : null}

        {tab === "train" && !active ? (
          <>
            <section className="hero-grid">
              <div className="hero-card">
                <div className="eyebrow">THIS WEEK</div>
                <h2>Three sessions build the physique. The fourth is earned.</h2>
                <p>
                  The baseline already contains productive weekly volume. Session D is extra volume
                  only when recovery is good — never a punishment for missing a day.
                </p>
                <div className="week-track">
                  {[0, 1, 2].map((n) => (
                    <div className={n < requiredThisWeek ? "track-dot filled" : "track-dot"} key={n}>
                      {n < requiredThisWeek ? "✓" : n + 1}
                    </div>
                  ))}
                  <div className={completedThisWeek.some((w) => w.sessionId === "D") ? "track-dot bonus filled" : "track-dot bonus"}>
                    D
                  </div>
                </div>
              </div>

              <div className="stats-grid">
                <Stat label="Core target" value="3× / week" hint="Session D optional" />
                <Stat label="Strength rule" value="Beat the log" hint="Reps → then load" />
                <Stat label="Most sets" value="1–2 RIR" hint="Failure used selectively" />
                <Stat
                  label="Bodyweight"
                  value={latestBody ? latestBody.weight + " kg" : "Log it"}
                  hint="Use the weekly trend"
                />
              </div>
            </section>

            <section>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">TODAY</div>
                  <h2>Choose the next session</h2>
                  <p>Recommended next: <strong>Session {selected}</strong>. The core rotation is A → B → C → repeat.</p>
                </div>
              </div>

              <div className="session-grid">
                {sessions.map((session) => (
                  <article
                    className={selected === session.id ? "session-card selected" : "session-card"}
                    key={session.id}
                    onClick={() => setSelected(session.id)}
                  >
                    <div className="session-id">{session.id}</div>
                    <div className="session-copy">
                      <div className="session-meta">
                        {session.required ? "CORE" : "OPTIONAL"} · {session.duration}
                      </div>
                      <h3>{session.title}</h3>
                      <p>{session.subtitle}</p>
                      <div className="chips">
                        {session.exercises.slice(0, 4).map((exercise) => (
                          <span key={exercise.id}>{exercise.target}</span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="start-bar">
                <div>
                  <strong>Session {chosenSession.id}</strong>
                  <span>{chosenSession.exercises.length} exercises · {chosenSession.duration}</span>
                </div>
                <Button className="primary" onClick={() => startWorkout(chosenSession)}>
                  Start workout →
                </Button>
              </div>
            </section>
          </>
        ) : null}

        {tab === "progress" ? (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">PROGRESS</div>
                <h2>Proof, not vibes.</h2>
                <p>Use performance trends and bodyweight trends to decide whether the plan is working.</p>
              </div>
            </div>

            <div className="calendar-strip" aria-label="Recent workout calendar">
              {dayStrip.map((day) => {
                const entries = workoutsByDate[day.date] || [];
                return (
                  <div className={day.date === isoDate() ? "cal-day today" : "cal-day"} key={day.date}>
                    <span>{day.weekday}</span>
                    <strong>{day.day}</strong>
                    <div className="cal-sessions">
                      {entries.map((sessionId, index) => (
                        <b key={sessionId + "-" + index}>{sessionId}</b>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="progress-grid">
              <article className="panel">
                <h3>Body metrics</h3>
                <div className="input-pair">
                  <label>
                    Weight (kg)
                    <input
                      inputMode="decimal"
                      value={bodyWeight}
                      onChange={(e) => setBodyWeight(e.target.value)}
                      placeholder="100.0"
                    />
                  </label>
                  <label>
                    Waist (cm, optional)
                    <input
                      inputMode="decimal"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="—"
                    />
                  </label>
                </div>
                <Button className="primary" onClick={saveBody}>Log today</Button>

                <div className="body-list">
                  {[...store.body].reverse().slice(0, 8).map((entry) => (
                    <div key={entry.date + "-" + entry.weight}>
                      <span>{entry.date}</span>
                      <strong>{entry.weight} kg</strong>
                      <span>{entry.waist ? entry.waist + " cm waist" : ""}</span>
                    </div>
                  ))}
                  {!store.body.length ? <p className="muted">No bodyweight entries yet.</p> : null}
                </div>
              </article>

              <article className="panel">
                <h3>Weekly performance</h3>
                <div className="big-number">{completedThisWeek.length}</div>
                <p>sessions completed this week</p>
                <div className="mini-rule"><strong>Success bar:</strong> A + B + C. D only when recovered.</div>
              </article>
            </div>

            <article className="panel history-panel">
              <h3>Workout history</h3>
              <div className="history">
                {[...store.workouts].reverse().map((workout) => (
                  <div className="history-row" key={workout.id}>
                    <div>
                      <span className="history-session">Session {workout.sessionId}</span>
                      <strong>{workout.date}</strong>
                      <span>
                        {Object.values(workout.sets).flat().filter((set) => set.done).length} sets
                        {workout.durationMin ? " · " + workout.durationMin + " min" : ""}
                      </span>
                    </div>
                    <button onClick={() => deleteWorkout(workout.id)}>Delete</button>
                  </div>
                ))}
                {!store.workouts.length ? <p className="muted">Finish your first workout and it will appear here.</p> : null}
              </div>
            </article>
          </section>
        ) : null}

        {tab === "plan" ? (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">THE PROGRAM</div>
                <h2>Built for strength, muscle and repeatability.</h2>
                <p>Stable exercises, enough hard sets, deliberate recovery, and a clear double-progression system.</p>
              </div>
            </div>

            <div className="volume-table">
              {weeklyDirectSets.map(([muscle, sets]) => (
                <div key={muscle}>
                  <strong>{muscle}</strong>
                  <span>{sets}</span>
                </div>
              ))}
            </div>

            {sessions.map((session) => (
              <article className="plan-session" key={session.id}>
                <div className="plan-session-head">
                  <div className="session-id">{session.id}</div>
                  <div>
                    <h3>{session.title}</h3>
                    <p>{session.subtitle}</p>
                  </div>
                  <span>{session.required ? "CORE" : "OPTIONAL"}</span>
                </div>
                <div className="plan-exercises">
                  {session.exercises.map((exercise) => (
                    <div className="plan-exercise" key={exercise.id}>
                      <div>
                        <strong>{exercise.name}</strong>
                        <span>{exercise.target}</span>
                      </div>
                      <span>{exercise.sets} × {exercise.reps}</span>
                      <span>{exercise.rir}</span>
                      <a href={exercise.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {tab === "guide" ? (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">WHY THIS WORKS</div>
                <h2>The rules that stop us wasting months.</h2>
              </div>
            </div>

            <div className="principle-grid">
              {principles.map(([title, text], index) => (
                <article className="principle" key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>

            <article className="panel nutrition">
              <div>
                <div className="eyebrow">NUTRITION</div>
                <h3>Eat like a human, not a meal-prep robot.</h3>
                <p>
                  Base meals around a substantial protein source, keep calories aligned with the
                  current body-composition goal, and use foods you will actually keep eating.
                </p>
              </div>
              <div className="meal-grid">
                {mealIdeas.map((meal) => <div key={meal}>{meal}</div>)}
              </div>
              <div className="protein-note">
                A practical evidence-based protein target for resistance-trained adults is roughly
                1.6 g/kg/day, with somewhat higher intakes often useful during calorie restriction.
              </div>
            </article>

            <div className="science-grid">
              {science.map((item) => (
                <a className="science-card" href={item.url} target="_blank" rel="noreferrer" key={item.title}>
                  <span>EVIDENCE</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <strong>Read source ↗</strong>
                </a>
              ))}
            </div>

            <article className="safety">
              <strong>Training rule:</strong> muscular effort is expected; sharp, worsening, unstable,
              or unusual joint pain is not a progression target. Change the exercise, range, setup,
              or load and get professional assessment for persistent or concerning symptoms.
            </article>
          </section>
        ) : null}

        {tab === "settings" ? (
          <section>
            <div className="section-heading">
              <div>
                <div className="eyebrow">YOUR GYM</div>
                <h2>Equipment-aware substitutions.</h2>
                <p>
                  Keep only the equipment you actually have. During a workout the app flags any
                  mismatch and gives alternatives that preserve the training goal.
                </p>
              </div>
            </div>

            <div className="equipment-grid">
              {allEquipment.map((item) => {
                const checked = store.equipment.includes(item);
                return (
                  <button
                    className={checked ? "equipment checked" : "equipment"}
                    key={item}
                    onClick={() => toggleEquipment(item)}
                  >
                    <span>{checked ? "✓" : "+"}</span>
                    <strong>{item}</strong>
                  </button>
                );
              })}
            </div>

            <article className="panel data-panel">
              <h3>Data</h3>
              <p>
                This build stores your log in this browser so it works immediately without an account.
                The repository also includes a Supabase schema for cross-device cloud sync.
              </p>
              <Button
                className="ghost"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "carry-the-boats-" + isoDate() + ".json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export my data
              </Button>
            </article>
          </section>
        ) : null}
      </div>

      <footer>
        <strong>CARRY THE BOATS</strong>
        <span>Consistency × progressive overload × recovery.</span>
      </footer>
    </main>
  );
}

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
type BodyEntry = {
  date: string;
  weight: number;
  waist?: number;
  shoulders?: number;
  arms?: number;
  thighs?: number;
};
type AppStore = {
  workouts: Workout[];
  body: BodyEntry[];
  equipment: Equipment[];
  updatedAt: number;
};
type MainTab = "program" | "workout" | "progress" | "nutrition" | "more";
type ProgressTab = "exercises" | "weight" | "body";
type ThemeMode = "system" | "light" | "dark";
type ExerciseDetailTab = "animation" | "muscles" | "steps";
type WeightPickerState = { exerciseId: string; index: number; exerciseName: string } | null;

const STORAGE_KEY = "carry-the-boats-v8";
const LEGACY_KEYS = ["carry-the-boats-v7", "carry-the-boats-v6", "carry-the-boats-v5", "carry-the-boats-v4"];
const THEME_KEY = "carry-the-boats-theme-v1";
const SYNC_KEY_STORAGE = "carry-the-boats-recovery-key-v1";
const SYNC_ENDPOINT = "https://xzgxqylefceimcciwzmm.supabase.co/functions/v1/workout-sync";
const WEIGHT_OPTIONS = [5,10,12.5,15,17.5,20,22.5,25,27.5,30,32.5,35,40,45,50,55,60,65,70,75,80,85,90,100];
const DIRECT_VOLUME_GROUPS: Record<string, string[]> = {
  incline: ["Upper chest"],
  inclineC: ["Upper chest"],
  pulldown: ["Lats"],
  singlelat: ["Lats"],
  row: ["Upper back"],
  rowC: ["Upper back"],
  "cable-lateral-raise": ["Lateral delts"],
  "reverse-pec-deck": ["Rear delts"],
  shrug: ["Upper traps"],
  "leg-press": ["Quads"],
  "leg-extension": ["Quads"],
  "seated-leg-curl": ["Hamstrings"],
  hip: ["Glutes"]
};
const VOLUME_REFERENCE_SETS = 10;

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
function workoutVolume(workout: Workout) {
  return Object.values(workout.sets).flat().filter((set) => set.done)
    .reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
}
function completedSetCount(workout: Workout) {
  return Object.values(workout.sets).flat().filter((set) => set.done).length;
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
  if (hours) return hours + "h " + String(minutes).padStart(2, "0") + "m";
  return minutes + ":" + String(secs).padStart(2, "0");
}
function latestExerciseLogs(workouts: Workout[]) {
  const result: Record<string, SetLog[]> = {};
  for (const workout of [...workouts].reverse()) {
    if (!workout.completed) continue;
    for (const [exerciseId, sets] of Object.entries(workout.sets)) {
      const key = workout.sessionId + ":" + exerciseId;
      if (!result[key]) result[key] = sets;
    }
  }
  return result;
}
function progressionAdvice(exercise: Exercise, previous?: SetLog[]) {
  const done = (previous || []).filter((set) => set.done && Number(set.reps) > 0);
  if (!done.length) return "Build a clean baseline today. Leave the planned reps in reserve.";
  const reps = done.map((set) => Number(set.reps));
  const min = Math.min(...reps);
  const weights = done.map((set) => Number(set.weight)).filter((n) => Number.isFinite(n) && n > 0);
  const sameWeight = weights.length > 0 && weights.every((w) => w === weights[0]);
  const targetRir = Number(exercise.rir.match(/\d+/)?.[0] || 0);
  const actualRirs = done.map((set) => Number(set.rir)).filter((n) => Number.isFinite(n) && n >= 0);
  const rirReady = actualRirs.length < done.length || Math.min(...actualRirs) >= targetRir;
  if (sameWeight && min >= exercise.maxRep && rirReady) {
    return "Next session: add about " + exercise.loadStep + " kg, then rebuild inside " + exercise.reps + ".";
  }
  if (min >= exercise.minRep) return "Keep this load and add reps until every set reaches " + exercise.maxRep + ".";
  return "Keep or slightly reduce the load so every work set lands in range with clean form.";
}
function epleyEstimate(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0 || reps > 12) return 0;
  return weight * (1 + reps / 30);
}
function rollingWeightAverage(entries: BodyEntry[]) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((entry, index) => {
    const end = new Date(entry.date + "T12:00:00");
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const window = sorted.slice(0, index + 1).filter((item) => {
      const date = new Date(item.date + "T12:00:00");
      return date >= start && date <= end;
    });
    return window.reduce((sum, item) => sum + item.weight, 0) / Math.max(1, window.length);
  });
}
function createRecoveryKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function hasMeaningfulData(store: AppStore) {
  return store.workouts.length > 0 || store.body.length > 0;
}
function equipmentMatch(exercise: Exercise, available: Equipment[]) {
  return exercise.equipment.some((item) => available.includes(item));
}
function weekDays() {
  const now = new Date();
  const monday = new Date(now);
  const weekday = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - weekday);
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return {
      label: d.toLocaleDateString("en-GB", { weekday: "short" }),
      day: d.getDate(),
      date: isoDate(d),
      today: isoDate(d) === isoDate()
    };
  });
}
function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", children, ...rest } = props;
  return <button className={"button " + className} {...rest}>{children}</button>;
}

type MotionKind = "press" | "pulldown" | "row" | "lateral" | "fly" | "shrug" | "legpress" | "legcurl" | "hip" | "extension" | "calf" | "curl" | "pushdown";
function motionKind(exercise: Exercise): MotionKind {
  if (exercise.id === "press" || exercise.id === "incline" || exercise.id === "inclineC") return "press";
  if (exercise.id === "pulldown" || exercise.id === "singlelat") return "pulldown";
  if (exercise.id === "row" || exercise.id === "rowC") return "row";
  if (exercise.id === "cable-lateral-raise") return "lateral";
  if (exercise.id === "reverse-pec-deck") return "fly";
  if (exercise.id === "shrug") return "shrug";
  if (exercise.id === "leg-press") return "legpress";
  if (exercise.id === "seated-leg-curl") return "legcurl";
  if (exercise.id === "hip") return "hip";
  if (exercise.id === "leg-extension") return "extension";
  if (exercise.id === "calf") return "calf";
  if (exercise.id === "biceps") return "curl";
  return "pushdown";
}

function ExerciseArt({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
  const kind = motionKind(exercise);
  return (
    <div className={"exercise-art motion-" + kind + (compact ? " compact" : "")}>
      <svg viewBox="0 0 320 220" aria-label={"Animated " + exercise.name}>
        <g className="art-machine">
          <line x1="35" y1="185" x2="286" y2="185" />
          <rect className="art-bench" x="88" y="146" width="120" height="12" rx="5" />
          <line className="art-rack" x1="74" y1="48" x2="74" y2="183" />
          <line className="art-rack" x1="246" y1="48" x2="246" y2="183" />
          <line className="art-cable" x1="260" y1="40" x2="260" y2="176" />
          <rect className="art-sled" x="218" y="90" width="50" height="62" rx="7" />
        </g>
        <g className="art-person">
          <circle className="skin head" cx="150" cy="70" r="17" />
          <path className="body torso" d="M137 88 Q150 78 163 88 L174 132 Q150 145 126 132 Z" />
          <g className="arms">
            <path className="limb left-arm" d="M133 96 Q110 105 92 126" />
            <path className="limb right-arm" d="M167 96 Q190 105 208 126" />
            <path className="limb left-forearm" d="M92 126 L82 153" />
            <path className="limb right-forearm" d="M208 126 L218 153" />
          </g>
          <g className="legs">
            <path className="limb left-thigh" d="M139 133 Q126 155 112 174" />
            <path className="limb right-thigh" d="M161 133 Q174 155 188 174" />
            <path className="limb left-shin" d="M112 174 L110 204" />
            <path className="limb right-shin" d="M188 174 L190 204" />
          </g>
          <g className="muscle-highlight">
            <ellipse className="chest-muscle" cx="150" cy="103" rx="27" ry="15" />
            <ellipse className="left-delt" cx="128" cy="99" rx="9" ry="12" />
            <ellipse className="right-delt" cx="172" cy="99" rx="9" ry="12" />
            <path className="lat-muscle" d="M130 104 Q115 119 129 134 L141 122 Z" />
            <path className="lat-muscle right" d="M170 104 Q185 119 171 134 L159 122 Z" />
            <ellipse className="quad-muscle" cx="127" cy="160" rx="10" ry="20" />
            <ellipse className="quad-muscle right" cx="173" cy="160" rx="10" ry="20" />
          </g>
        </g>
        <g className="art-barbell">
          <line x1="55" y1="132" x2="245" y2="132" />
          <circle cx="67" cy="132" r="22" />
          <circle cx="233" cy="132" r="22" />
        </g>
        <path className="motion-arrow" d="M286 158 L286 87 M279 96 L286 87 L293 96" />
      </svg>
    </div>
  );
}

function MuscleMap({ exercise }: { exercise: Exercise }) {
  const target = exercise.target.toLowerCase();
  const chest = target.includes("chest");
  const shoulders = target.includes("delt") || target.includes("shoulder");
  const back = target.includes("lat") || target.includes("back") || target.includes("trap");
  const quads = target.includes("quad");
  const hams = target.includes("hamstring");
  const glutes = target.includes("glute");
  const arms = target.includes("biceps") || target.includes("triceps");
  return (
    <div className="muscle-map-wrap">
      {["Front", "Back"].map((side) => (
        <div className="muscle-figure" key={side}>
          <span>{side}</span>
          <svg viewBox="0 0 130 250">
            <circle cx="65" cy="28" r="20" className="body-base" />
            <path d="M45 52 Q65 42 85 52 L97 120 Q65 138 33 120 Z" className="body-base" />
            <path d="M38 62 L15 115 L24 122 L48 82" className="body-base limb-shape" />
            <path d="M92 62 L115 115 L106 122 L82 82" className="body-base limb-shape" />
            <path d="M48 122 L38 214 L55 218 L65 140" className="body-base limb-shape" />
            <path d="M82 122 L92 214 L75 218 L65 140" className="body-base limb-shape" />
            {side === "Front" && chest ? <ellipse cx="65" cy="75" rx="25" ry="15" className="muscle-hot" /> : null}
            {shoulders ? <>
              <ellipse cx="42" cy="68" rx="9" ry="15" className="muscle-hot" />
              <ellipse cx="88" cy="68" rx="9" ry="15" className="muscle-hot" />
            </> : null}
            {back && side === "Back" ? <path d="M43 72 Q65 56 87 72 L82 110 Q65 125 48 110 Z" className="muscle-hot" /> : null}
            {arms ? <>
              <ellipse cx="29" cy="96" rx="7" ry="17" className="muscle-hot" />
              <ellipse cx="101" cy="96" rx="7" ry="17" className="muscle-hot" />
            </> : null}
            {quads && side === "Front" ? <>
              <ellipse cx="51" cy="166" rx="10" ry="28" className="muscle-hot" />
              <ellipse cx="79" cy="166" rx="10" ry="28" className="muscle-hot" />
            </> : null}
            {hams && side === "Back" ? <>
              <ellipse cx="51" cy="166" rx="10" ry="28" className="muscle-hot" />
              <ellipse cx="79" cy="166" rx="10" ry="28" className="muscle-hot" />
            </> : null}
            {glutes && side === "Back" ? <ellipse cx="65" cy="132" rx="25" ry="16" className="muscle-hot" /> : null}
          </svg>
        </div>
      ))}
    </div>
  );
}

function exerciseSteps(exercise: Exercise) {
  const kind = motionKind(exercise);
  const common = [
    "Set your position so the target muscle can move through a comfortable range.",
    "Control the lowering phase instead of letting the stack or weight drop.",
    "Drive the weight through the intended path without bouncing or twisting.",
    "Stop the set with the planned reps in reserve and log the result."
  ];
  if (kind === "press") return ["Set shoulder blades against the bench or pad and plant your feet.", "Lower under control until the upper arm reaches a comfortable depth.", "Press up while keeping the shoulders stable.", "Finish with the planned reps in reserve; do not grind every set."];
  if (kind === "legpress") return ["Set your feet where knees and ankles feel stable.", "Lower the sled under control to your pain-free depth.", "Drive through the whole foot without locking the knees hard.", "Keep your hips against the pad and stop before form changes."];
  if (kind === "lateral") return ["Set the cable slightly behind or beside you.", "Lead with the elbow and raise the arm out to the side.", "Pause briefly near shoulder height without shrugging.", "Lower slowly and keep tension on the side delt."];
  return common;
}

function NavIcon({ tab }: { tab: MainTab }) {
  if (tab === "program") return <svg viewBox="0 0 24 24"><path d="M4 6h16v14H4zM8 3v6M16 3v6M8 13h8" /></svg>;
  if (tab === "workout") return <svg viewBox="0 0 24 24"><path d="M5 9v6M8 7v10M16 7v10M19 9v6M8 12h8" /></svg>;
  if (tab === "progress") return <svg viewBox="0 0 24 24"><path d="M4 18l5-6 4 3 7-9M18 6h2v2" /></svg>;
  if (tab === "nutrition") return <svg viewBox="0 0 24 24"><path d="M12 3c3 4 5 6 5 10a5 5 0 01-10 0c0-4 2-6 5-10zM8 21h8" /></svg>;
  return <svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h14" /></svg>;
}

function LineChart({ values }: { values: number[] }) {
  if (!values.length) return <div className="chart-empty">Log sessions to build this graph.</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = values.map((v, i) => {
    const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100;
    const y = 86 - ((v - min) / spread) * 66;
    return x + "," + y;
  }).join(" ");
  return (
    <svg className="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="M0 88 H100 M0 66 H100 M0 44 H100 M0 22 H100" className="chart-grid" />
      <polyline points={points} className="chart-line" vectorEffect="non-scaling-stroke" />
      {values.map((v, i) => {
        const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100;
        const y = 86 - ((v - min) / spread) * 66;
        return <circle key={i} cx={x} cy={y} r="1.8" className="chart-point" />;
      })}
    </svg>
  );
}

export default function Home() {
  const [tab, setTab] = useState<MainTab>("program");
  const [progressTab, setProgressTab] = useState<ProgressTab>("exercises");
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");
  const [store, setStore] = useState<AppStore>({ workouts: [], body: [], equipment: defaultEquipment, updatedAt: 0 });
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Session["id"]>("A");
  const [routineDetail, setRoutineDetail] = useState<Session["id"] | null>(null);
  const [active, setActive] = useState<Workout | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [timer, setTimer] = useState(0);
  const [timerLabel, setTimerLabel] = useState("Rest");
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [detailTab, setDetailTab] = useState<ExerciseDetailTab>("animation");
  const [weightPicker, setWeightPicker] = useState<WeightPickerState>(null);
  const [customWeight, setCustomWeight] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [shoulders, setShoulders] = useState("");
  const [arms, setArms] = useState("");
  const [thighs, setThighs] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"local" | "checking" | "synced" | "error">("local");
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [selectedProgressExercise, setSelectedProgressExercise] = useState("leg-press");

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
          equipment: parsed.equipment?.length ? parsed.equipment : defaultEquipment,
          updatedAt: parsed.updatedAt || (parsedWorkouts.length || parsed.body?.length ? Date.now() : 0)
        });
        const lastCore = [...parsedWorkouts].reverse().find((w) => w.completed && w.sessionId !== "D");
        if (lastCore && (lastCore.sessionId === "A" || lastCore.sessionId === "B" || lastCore.sessionId === "C")) {
          setSelected(nextCoreId(lastCore.sessionId));
        }
      }
      const savedTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      if (savedTheme) setTheme(savedTheme);
      let recoveryKey = localStorage.getItem(SYNC_KEY_STORAGE) || "";
      if (!recoveryKey) {
        recoveryKey = createRecoveryKey();
        localStorage.setItem(SYNC_KEY_STORAGE, recoveryKey);
      }
      setSyncKey(recoveryKey);
      setRecoveryInput(recoveryKey);
    } catch {}
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => setSystemTheme(media.matches ? "light" : "dark");
    apply();
    media.addEventListener?.("change", apply);
    setReady(true);
    return () => media.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [ready, store]);
  useEffect(() => {
    if (ready) localStorage.setItem(THEME_KEY, theme);
  }, [ready, theme]);
  useEffect(() => {
    if (!active || !startedAt) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);
  useEffect(() => {
    if (timer <= 0) return;
    const id = window.setInterval(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!ready || !syncKey) return;
    let cancelled = false;
    setSyncReady(false);
    setSyncStatus("checking");
    (async () => {
      try {
        const response = await fetch(SYNC_ENDPOINT, { method: "GET", headers: { "x-recovery-key": syncKey } });
        if (cancelled) return;
        if (response.ok) {
          const remote = await response.json() as { payload?: Partial<AppStore>; updatedAt?: number };
          const remoteUpdatedAt = Number(remote.updatedAt || 0);
          if (remote.payload && remoteUpdatedAt > store.updatedAt) {
            setStore({
              workouts: remote.payload.workouts || [],
              body: remote.payload.body || [],
              equipment: remote.payload.equipment?.length ? remote.payload.equipment : defaultEquipment,
              updatedAt: remoteUpdatedAt
            });
          } else if (store.updatedAt > 0 || hasMeaningfulData(store)) {
            await fetch(SYNC_ENDPOINT, {
              method: "PUT",
              headers: { "Content-Type": "application/json", "x-recovery-key": syncKey },
              body: JSON.stringify({ payload: store, updatedAt: store.updatedAt || Date.now() })
            });
          }
        } else if (response.status === 404 && (store.updatedAt > 0 || hasMeaningfulData(store))) {
          await fetch(SYNC_ENDPOINT, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-recovery-key": syncKey },
            body: JSON.stringify({ payload: store, updatedAt: store.updatedAt || Date.now() })
          });
        }
        if (!cancelled) {
          setSyncReady(true);
          setSyncStatus("synced");
        }
      } catch {
        if (!cancelled) setSyncStatus("error");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, syncKey]);

  useEffect(() => {
    if (!ready || !syncReady || !syncKey || store.updatedAt <= 0) return;
    const id = window.setTimeout(async () => {
      try {
        setSyncStatus("checking");
        const response = await fetch(SYNC_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-recovery-key": syncKey },
          body: JSON.stringify({ payload: store, updatedAt: store.updatedAt })
        });
        setSyncStatus(response.ok ? "synced" : "error");
      } catch {
        setSyncStatus("error");
      }
    }, 900);
    return () => window.clearTimeout(id);
  }, [ready, syncReady, syncKey, store]);

  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const previous = useMemo(() => latestExerciseLogs(store.workouts), [store.workouts]);
  const currentWeekDays = useMemo(weekDays, []);
  const chosenSession = sessions.find((s) => s.id === selected) || sessions[0];
  const routine = sessions.find((s) => s.id === routineDetail) || null;
  const completedThisWeek = store.workouts.filter((w) => w.completed && new Date(w.date + "T12:00:00").getTime() >= weekStart().getTime());
  const latestBody = store.body.at(-1);
  const weightRollingValues = useMemo(() => rollingWeightAverage(store.body), [store.body]);
  const latestWeightAverage = weightRollingValues.at(-1);
  const waistTrendValues = useMemo(() => store.body.filter((e) => typeof e.waist === "number").map((e) => Number(e.waist)), [store.body]);

  const actualWeeklyVolume = useMemo(() => {
    const totals: Record<string, number> = {
      "Upper chest":0, Lats:0, "Upper back":0, "Lateral delts":0, "Rear delts":0, "Upper traps":0, Quads:0, Hamstrings:0, Glutes:0
    };
    for (const workout of store.workouts) {
      if (!workout.completed || new Date(workout.date + "T12:00:00").getTime() < weekStart().getTime()) continue;
      for (const [exerciseId, sets] of Object.entries(workout.sets)) {
        const count = sets.filter((set) => set.done).length;
        for (const group of DIRECT_VOLUME_GROUPS[exerciseId] || []) totals[group] += count;
      }
    }
    return Object.entries(totals);
  }, [store.workouts]);

  const progressConfigs = [
    { exerciseId:"press", sessionId:"A" as const, label:"Shoulder Press", metric:"e1rm" as const },
    { exerciseId:"leg-press", sessionId:"B" as const, label:"Leg Press", metric:"e1rm" as const },
    { exerciseId:"pulldown", sessionId:"A" as const, label:"Lat Pulldown", metric:"e1rm" as const },
    { exerciseId:"cable-lateral-raise", sessionId:"A" as const, label:"Cable Lateral Raise", metric:"fixed" as const }
  ];
  const progressData = useMemo(() => {
    return progressConfigs.map((config) => {
      const relevant = store.workouts.filter((w) => w.completed && w.sessionId === config.sessionId);
      if (config.metric === "e1rm") {
        const values = relevant.flatMap((workout) => {
          const best = (workout.sets[config.exerciseId] || []).filter((s) => s.done)
            .map((s) => epleyEstimate(Number(s.weight), Number(s.reps)))
            .reduce((max, value) => Math.max(max, value), 0);
          return best > 0 ? [best] : [];
        });
        return { ...config, values, latest: values.at(-1) || 0, unit:"kg e1RM" };
      }
      const last = [...relevant].reverse().find((w) => (w.sets[config.exerciseId] || []).some((s) => s.done && Number(s.weight) > 0));
      const reference = last ? Math.max(...(last.sets[config.exerciseId] || []).filter((s) => s.done).map((s) => Number(s.weight) || 0)) : 0;
      const values = reference ? relevant.flatMap((workout) => {
        const reps = (workout.sets[config.exerciseId] || []).filter((s) => s.done && Math.abs(Number(s.weight) - reference) < .01)
          .reduce((max, s) => Math.max(max, Number(s.reps) || 0), 0);
        return reps ? [reps] : [];
      }) : [];
      return { ...config, values, latest: values.at(-1) || 0, unit: reference ? "reps @ " + reference + "kg" : "reps" };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.workouts]);

  const selectedProgress = progressData.find((p) => p.exerciseId === selectedProgressExercise) || progressData[0];

  function stampStore(updater: (current: AppStore) => AppStore) {
    setStore((current) => ({ ...updater(current), updatedAt: Date.now() }));
  }
  function startWorkout(session: Session) {
    setSelected(session.id);
    setRoutineDetail(null);
    setActive(emptyWorkout(session));
    setStartedAt(Date.now());
    setClock(Date.now());
    setTab("workout");
    window.scrollTo({ top:0, behavior:"smooth" });
  }
  function updateSet(exerciseId: string, index: number, patch: Partial<SetLog>) {
    setActive((current) => {
      if (!current) return current;
      const next = current.sets[exerciseId].map((set, i) => i === index ? { ...set, ...patch } : set);
      return { ...current, sets:{ ...current.sets, [exerciseId]:next } };
    });
  }
  function addSet(exerciseId: string) {
    setActive((current) => current ? {
      ...current,
      sets:{ ...current.sets, [exerciseId]:[...(current.sets[exerciseId] || []), { weight:"", reps:"", rir:"", done:false }] }
    } : current);
  }
  function completeSet(exercise: Exercise, index: number) {
    if (!active) return;
    const set = active.sets[exercise.id][index];
    const done = !set.done;
    updateSet(exercise.id, index, { done });
    if (done) {
      setTimer(exercise.restSec);
      setTimerLabel(exercise.name);
      if (vibration && navigator.vibrate) navigator.vibrate(35);
    }
  }
  function finishWorkout() {
    if (!active) return;
    const saved = {
      ...active,
      completed:true,
      durationMin:startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : undefined
    };
    stampStore((current) => ({
      ...current,
      workouts:[...current.workouts.filter((w) => w.id !== saved.id), saved]
    }));
    if (active.sessionId === "A" || active.sessionId === "B" || active.sessionId === "C") setSelected(nextCoreId(active.sessionId));
    setActive(null);
    setStartedAt(null);
    setTimer(0);
    setTab("progress");
  }
  function saveBody() {
    const weight = Number(bodyWeight);
    if (!Number.isFinite(weight) || weight <= 0) return;
    const optional = (value:string) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const entry: BodyEntry = {
      date:isoDate(), weight,
      waist:optional(waist), shoulders:optional(shoulders), arms:optional(arms), thighs:optional(thighs)
    };
    stampStore((current) => ({ ...current, body:[...current.body, entry] }));
    setBodyWeight(""); setWaist(""); setShoulders(""); setArms(""); setThighs("");
  }
  function applyWeight(value:number) {
    if (!weightPicker) return;
    updateSet(weightPicker.exerciseId, weightPicker.index, { weight:String(Math.max(0, Math.round(value * 100) / 100)) });
    setWeightPicker(null);
    setCustomWeight("");
  }
  function useRecoveryKey() {
    const value = recoveryInput.trim();
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(value)) { setSyncStatus("error"); return; }
    localStorage.setItem(SYNC_KEY_STORAGE, value);
    setSyncReady(false);
    setSyncKey(value);
  }

  if (!ready) return <main className="loading-screen"><strong>Carry the Boats</strong><span>Loading…</span></main>;

  const elapsed = active && startedAt ? Math.max(0, Math.floor((clock - startedAt) / 1000)) : 0;
  const completedSets = active ? completedSetCount(active) : 0;
  const liveVolume = active ? workoutVolume(active) : 0;

  if (routine && !active) {
    return (
      <main className="ctb-app" data-theme={resolvedTheme}>
        <section className="phone-screen routine-detail-screen">
          <header className="detail-header">
            <button onClick={() => setRoutineDetail(null)}>‹</button>
            <button className="icon-button">⚙</button>
          </header>
          <div className="routine-title-block">
            <h1>{routine.id}. {routine.title}</h1>
            <p>{routine.duration} · {routine.exercises.length} exercises</p>
          </div>
          <div className="routine-exercise-list">
            {routine.exercises.map((exercise, index) => (
              <button className="routine-exercise-row" key={exercise.id + index} onClick={() => { setDetailExercise(exercise); setDetailTab("animation"); }}>
                <span className="exercise-order">{index + 1}</span>
                <ExerciseArt exercise={exercise} compact />
                <span className="routine-exercise-copy">
                  <strong>{exercise.name}</strong>
                  <small>{exercise.target}</small>
                  <em>{exercise.sets} × {exercise.reps}</em>
                </span>
              </button>
            ))}
          </div>
          <div className="sticky-start"><Button className="primary" onClick={() => startWorkout(routine)}>Start Workout</Button></div>
        </section>
        {detailExercise ? (
          <ExerciseDetailModal exercise={detailExercise} tab={detailTab} setTab={setDetailTab} onClose={() => setDetailExercise(null)} />
        ) : null}
      </main>
    );
  }

  if (active) {
    const session = sessions.find((s) => s.id === active.sessionId) || sessions[0];
    return (
      <main className="ctb-app" data-theme={resolvedTheme}>
        <section className="phone-screen active-workout-screen">
          <header className="workout-header">
            <button onClick={() => { if (completedSets === 0 || confirm("Discard this workout?")) setActive(null); }}>‹</button>
            <div><strong>Log Workout</strong><span>⌄</span></div>
            <Button className="finish-mini" disabled={!completedSets} onClick={finishWorkout}>Finish</Button>
          </header>
          <div className="workout-stats">
            <div><span>Time</span><strong>{formatDuration(elapsed)}</strong></div>
            <div><span>Volume</span><strong>{liveVolume.toLocaleString()} kg</strong></div>
            <div><span>Sets</span><strong>{completedSets}</strong></div>
          </div>

          <div className="workout-exercises">
            {session.exercises.map((exercise) => {
              const prev = previous[active.sessionId + ":" + exercise.id];
              return (
                <article className="workout-exercise-card" key={exercise.id}>
                  <div className="workout-exercise-title">
                    <button className="mini-art-button" onClick={() => { setDetailExercise(exercise); setDetailTab("animation"); }}><ExerciseArt exercise={exercise} compact /></button>
                    <div><strong>{exercise.name}</strong><span>{exercise.target}</span></div>
                    <button className="dots">⋮</button>
                  </div>
                  <button className="hero-animation" onClick={() => { setDetailExercise(exercise); setDetailTab("animation"); }}>
                    <ExerciseArt exercise={exercise} />
                    <span className="expand-badge">⛶</span>
                  </button>
                  <div className="rest-chip">◷ Rest Timer: {secsToClock(exercise.restSec)}</div>
                  <div className="coach-line"><strong>Next:</strong> {progressionAdvice(exercise, prev)}</div>
                  {!equipmentMatch(exercise, store.equipment) ? <div className="equipment-warning">Alternative: {exercise.alternatives.slice(0,2).join(" · ")}</div> : null}

                  <div className="set-grid set-head">
                    <span>SET</span><span>PREVIOUS</span><span>KG</span><span>REPS</span><span>RIR</span><span>✓</span>
                  </div>
                  {(active.sets[exercise.id] || []).map((set, index) => {
                    const old = prev?.[index];
                    const oldText = old ? ((old.weight || "—") + " × " + (old.reps || "—")) : "—";
                    return (
                      <div className={"set-grid set-row " + (set.done ? "done" : "")} key={index}>
                        <span className="set-index">{index + 1}</span>
                        <span className="previous-set">{oldText}</span>
                        <button className="weight-cell" onClick={() => setWeightPicker({ exerciseId:exercise.id, index, exerciseName:exercise.name })}>{set.weight || old?.weight || "—"}</button>
                        <input inputMode="numeric" value={set.reps} placeholder={old?.reps || String(exercise.minRep)} onChange={(e) => updateSet(exercise.id,index,{reps:e.target.value})} />
                        <select value={set.rir} onChange={(e) => updateSet(exercise.id,index,{rir:e.target.value})}><option value="">2</option><option>3</option><option>2</option><option>1</option><option>0</option></select>
                        <button className="set-check" onClick={() => completeSet(exercise,index)}>✓</button>
                      </div>
                    );
                  })}
                  <button className="add-set" onClick={() => addSet(exercise.id)}>＋ Add Set</button>
                </article>
              );
            })}
          </div>

          {timer > 0 ? (
            <div className="floating-timer">
              <button onClick={() => setTimer(Math.max(0,timer-15))}>−15</button>
              <div><span>{timerLabel}</span><strong>{secsToClock(timer)}</strong></div>
              <button onClick={() => setTimer(timer+15)}>+15</button>
              <button onClick={() => setTimer(0)}>Skip</button>
            </div>
          ) : null}
        </section>

        {detailExercise ? <ExerciseDetailModal exercise={detailExercise} tab={detailTab} setTab={setDetailTab} onClose={() => setDetailExercise(null)} /> : null}
        {weightPicker ? (
          <div className="modal-backdrop" onClick={() => setWeightPicker(null)}>
            <div className="weight-picker" onClick={(e) => e.stopPropagation()}>
              <div className="picker-header"><strong>Select Weight</strong><button onClick={() => setWeightPicker(null)}>✕</button></div>
              <div className="current-weight">{active.sets[weightPicker.exerciseId]?.[weightPicker.index]?.weight || "0"}<small>kg</small></div>
              <div className="weight-adjust">
                {[-2.5,-1.25,1.25,2.5].map((inc) => (
                  <button key={inc} onClick={() => {
                    const current = Number(active.sets[weightPicker.exerciseId]?.[weightPicker.index]?.weight || 0);
                    applyWeight(current + inc);
                  }}>{inc > 0 ? "+" : ""}{inc}</button>
                ))}
              </div>
              <div className="weight-grid">
                {WEIGHT_OPTIONS.map((w) => <button className={Number(active.sets[weightPicker.exerciseId]?.[weightPicker.index]?.weight) === w ? "selected" : ""} key={w} onClick={() => applyWeight(w)}>{w}</button>)}
              </div>
              <div className="custom-weight-row"><input inputMode="decimal" value={customWeight} onChange={(e) => setCustomWeight(e.target.value)} placeholder="Custom weight" /><Button className="primary" onClick={() => applyWeight(Number(customWeight) || 0)}>Set</Button></div>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="ctb-app" data-theme={resolvedTheme}>
      <section className="phone-screen main-screen">
        {tab === "program" ? (
          <>
            <header className="brand-header"><h1>Carry the Boats</h1><button className="profile-avatar">UN</button></header>
            <div className="week-strip">
              {currentWeekDays.map((d) => <div className={d.today ? "today" : ""} key={d.date}><span>{d.label}</span><strong>{d.day}</strong></div>)}
            </div>
            <div className="screen-heading"><h2>Your Program</h2><p>3–4 gym sessions per week</p></div>
            <div className="program-list">
              {sessions.map((session) => (
                <button className="program-card" key={session.id} onClick={() => setRoutineDetail(session.id)}>
                  <span className="program-letter">{session.id}</span>
                  <span className="program-copy"><strong>{session.title}</strong><small>{session.exercises.length} exercises · {session.duration}</small></span>
                  <ExerciseArt exercise={session.exercises[0]} compact />
                </button>
              ))}
            </div>
            <div className="next-workout-card">
              <div><span>Recommended next</span><strong>Session {selected}: {chosenSession.title}</strong><small>{chosenSession.duration}</small></div>
              <Button className="primary" onClick={() => startWorkout(chosenSession)}>Start</Button>
            </div>
          </>
        ) : null}

        {tab === "workout" ? (
          <>
            <header className="simple-header"><h1>Workout</h1><button onClick={() => setTab("program")}>Program</button></header>
            <div className="quick-start-card">
              <span>NEXT ROUTINE</span>
              <h2>{selected}. {chosenSession.title}</h2>
              <p>{chosenSession.exercises.length} exercises · {chosenSession.duration}</p>
              <ExerciseArt exercise={chosenSession.exercises[0]} />
              <Button className="primary full" onClick={() => startWorkout(chosenSession)}>Start Workout</Button>
            </div>
            <div className="recent-section"><h3>Recent workouts</h3>
              {[...store.workouts].reverse().slice(0,3).map((workout) => {
                const session = sessions.find((s) => s.id === workout.sessionId) || sessions[0];
                return <button key={workout.id} className="recent-workout" onClick={() => startWorkout(session)}><span className="program-letter">{workout.sessionId}</span><div><strong>{session.title}</strong><small>{workout.date} · {completedSetCount(workout)} sets · {workoutVolume(workout).toLocaleString()} kg</small></div><span>›</span></button>;
              })}
            </div>
          </>
        ) : null}

        {tab === "progress" ? (
          <>
            <header className="simple-header"><h1>Progress</h1><button className="icon-button">⚙</button></header>
            <div className="segmented"><button className={progressTab==="exercises"?"active":""} onClick={() => setProgressTab("exercises")}>Exercises</button><button className={progressTab==="weight"?"active":""} onClick={() => setProgressTab("weight")}>Weight</button><button className={progressTab==="body"?"active":""} onClick={() => setProgressTab("body")}>Body Metrics</button></div>
            {progressTab === "exercises" ? (
              <div className="progress-panel">
                <select className="exercise-select" value={selectedProgressExercise} onChange={(e) => setSelectedProgressExercise(e.target.value)}>
                  {progressData.map((p) => <option key={p.exerciseId} value={p.exerciseId}>{p.label}</option>)}
                </select>
                <div className="range-tabs"><button>1M</button><button className="active">3M</button><button>6M</button><button>1Y</button><button>All</button></div>
                <div className="big-chart"><LineChart values={selectedProgress.values.slice(-12)} /></div>
                <div className="metric-cards">
                  <div><span>Latest</span><strong>{selectedProgress.latest ? selectedProgress.latest.toFixed(selectedProgress.metric === "e1rm" ? 1 : 0) : "—"}</strong><small>{selectedProgress.unit}</small></div>
                  <div><span>Total volume</span><strong>{store.workouts.reduce((sum,w) => sum + workoutVolume(w),0).toLocaleString()}</strong><small>kg</small></div>
                  <div><span>Sessions</span><strong>{store.workouts.length}</strong><small>all time</small></div>
                </div>
                <h3>Recent Sets</h3>
                <div className="recent-sets">
                  {[...store.workouts].reverse().filter((w) => w.sessionId === selectedProgress.sessionId).slice(0,4).map((w) => {
                    const sets = (w.sets[selectedProgress.exerciseId] || []).filter((s) => s.done);
                    const best = sets.reduce((best,s) => Number(s.weight)>Number(best?.weight||0)?s:best, sets[0]);
                    return <div key={w.id}><span>{w.date}</span><strong>{best ? (best.weight || "—") + " kg × " + (best.reps || "—") : "—"}</strong></div>;
                  })}
                </div>
                <div className="actual-volume-card"><h3>Completed volume this week</h3>{actualWeeklyVolume.map(([muscle,sets]) => <div key={muscle} className="volume-row"><span>{muscle}</span><div><i style={{width:Math.min(100,(sets/VOLUME_REFERENCE_SETS)*100)+"%"}} /></div><strong>{sets}</strong></div>)}</div>
              </div>
            ) : null}
            {progressTab === "weight" ? (
              <div className="progress-panel">
                <div className="body-chart-card"><span>7-day rolling average</span><strong>{latestWeightAverage ? latestWeightAverage.toFixed(1)+" kg" : "No data"}</strong><LineChart values={weightRollingValues.slice(-14)} /></div>
                <MeasurementForm />
              </div>
            ) : null}
            {progressTab === "body" ? (
              <div className="progress-panel">
                <div className="body-chart-card"><span>Waist</span><strong>{latestBody?.waist ? latestBody.waist+" cm" : "No data"}</strong><LineChart values={waistTrendValues.slice(-14)} /></div>
                <MeasurementForm />
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "nutrition" ? (
          <>
            <header className="simple-header"><h1>Nutrition</h1><button className="icon-button">⚙</button></header>
            <div className="segmented"><button className="active">Daily Log</button><button>Meal Ideas</button></div>
            <div className="nutrition-date">‹ &nbsp; {new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})} &nbsp; ›</div>
            <div className="macro-summary">
              <div className="calorie-ring"><div><strong>2 450</strong><span>/ 2 800 kcal</span></div></div>
              <div className="macro-bars">
                {[["Protein",180,200],["Carbs",260,300],["Fats",90,100]].map(([name,val,max]) => <div key={String(name)}><div><span>{name}</span><strong>{val} / {max} g</strong></div><i><b style={{width:(Number(val)/Number(max))*100+"%"}} /></i></div>)}
              </div>
            </div>
            <div className="meal-heading"><h3>Meals</h3><button>＋ Add Meal</button></div>
            <div className="meal-cards">
              {[
                ["Lunch","Egusi Soup + Chicken + Rice","720 kcal"],
                ["Breakfast","Oats + Banana + Protein","520 kcal"],
                ["Dinner","Grilled Chicken + Plantain + Vegetables","660 kcal"]
              ].map(([title,meal,kcal]) => <div key={title} className="meal-card"><div className="meal-thumb">{title[0]}</div><div><strong>{title}</strong><span>{meal}</span><small>{kcal}</small></div><span>›</span></div>)}
            </div>
            <div className="nutrition-ideas"><h3>Meal ideas</h3>{mealIdeas.slice(0,5).map((m) => <div key={m}>{m}</div>)}</div>
          </>
        ) : null}

        {tab === "more" ? (
          <>
            <header className="simple-header"><button onClick={() => setTab("program")}>‹</button><h1>App Settings</h1><span /></header>
            <section className="settings-section"><h3>Appearance</h3><div className="theme-grid">
              {(["system","light","dark"] as ThemeMode[]).map((mode) => <button key={mode} className={theme===mode?"selected":""} onClick={() => setTheme(mode)}><span>{mode==="system"?"◐":mode==="light"?"☼":"☾"}</span><strong>{mode[0].toUpperCase()+mode.slice(1)}</strong></button>)}
            </div></section>
            <section className="settings-section"><h3>Units</h3><div className="unit-toggle"><button className="active">Metric (kg)</button><button>Imperial (lb)</button></div></section>
            <section className="settings-section settings-list">
              <div><span>Rest Timer Sound</span><button className={"switch "+(sound?"on":"")} onClick={() => setSound(!sound)}><i /></button></div>
              <div><span>Vibration</span><button className={"switch "+(vibration?"on":"")} onClick={() => setVibration(!vibration)}><i /></button></div>
              <details><summary>Equipment at My Gym</summary><div className="equipment-options">{allEquipment.map((item) => <button className={store.equipment.includes(item)?"selected":""} key={item} onClick={() => stampStore((current) => ({...current,equipment:current.equipment.includes(item)?current.equipment.filter((x)=>x!==item):[...current.equipment,item]}))}>{store.equipment.includes(item)?"✓ ":"＋ "}{item}</button>)}</div></details>
              <details><summary>Data & Export</summary><div className="sync-card"><span className={"sync-status "+syncStatus}>{syncStatus}</span><p>Your recovery key protects the cloud copy.</p><code>{syncKey}</code><Button className="secondary" onClick={() => navigator.clipboard?.writeText(syncKey)}>Copy key</Button><input value={recoveryInput} onChange={(e) => setRecoveryInput(e.target.value)} placeholder="Paste recovery key"/><Button className="primary" onClick={useRecoveryKey}>Use & restore</Button></div></details>
              <div><span>Notifications</span><span>›</span></div>
              <div><span>Language</span><span>English ›</span></div>
            </section>
            <section className="settings-section"><h3>Training principles</h3>{principles.slice(0,4).map(([title,text]) => <div className="principle-mini" key={title}><strong>{title}</strong><span>{text}</span></div>)}</section>
            <section className="settings-section"><h3>Evidence</h3>{science.slice(0,4).map((s) => <a className="evidence-mini" key={s.title} href={s.url} target="_blank" rel="noreferrer"><strong>{s.title}</strong><span>↗</span></a>)}</section>
          </>
        ) : null}

        <nav className="bottom-nav">
          {(["program","workout","progress","nutrition","more"] as MainTab[]).map((item) => <button className={tab===item?"active":""} key={item} onClick={() => setTab(item)}><NavIcon tab={item}/><span>{item[0].toUpperCase()+item.slice(1)}</span></button>)}
        </nav>
      </section>

      {detailExercise ? <ExerciseDetailModal exercise={detailExercise} tab={detailTab} setTab={setDetailTab} onClose={() => setDetailExercise(null)} /> : null}
    </main>
  );

  function MeasurementForm() {
    return (
      <div className="measurement-form">
        <div><label>Weight (kg)<input value={bodyWeight} onChange={(e) => setBodyWeight(e.target.value)} inputMode="decimal" /></label><label>Waist (cm)<input value={waist} onChange={(e) => setWaist(e.target.value)} inputMode="decimal" /></label></div>
        <div><label>Shoulders<input value={shoulders} onChange={(e) => setShoulders(e.target.value)} inputMode="decimal" /></label><label>Arms<input value={arms} onChange={(e) => setArms(e.target.value)} inputMode="decimal" /></label><label>Thighs<input value={thighs} onChange={(e) => setThighs(e.target.value)} inputMode="decimal" /></label></div>
        <Button className="primary full" onClick={saveBody}>Log measurements</Button>
      </div>
    );
  }
}

function ExerciseDetailModal({
  exercise,
  tab,
  setTab,
  onClose
}: {
  exercise: Exercise;
  tab: ExerciseDetailTab;
  setTab: (tab: ExerciseDetailTab) => void;
  onClose: () => void;
}) {
  const steps = exerciseSteps(exercise);
  return (
    <div className="modal-backdrop exercise-detail-backdrop" onClick={onClose}>
      <div className="exercise-detail-modal" onClick={(e) => e.stopPropagation()}>
        <header><button onClick={onClose}>‹</button><strong>{exercise.name}</strong><button className="icon-button">⚙</button></header>
        <div className="segmented detail-tabs"><button className={tab==="animation"?"active":""} onClick={() => setTab("animation")}>Animation</button><button className={tab==="muscles"?"active":""} onClick={() => setTab("muscles")}>Muscles</button><button className={tab==="steps"?"active":""} onClick={() => setTab("steps")}>Steps</button></div>
        {tab === "animation" ? (
          <>
            <div className="detail-animation"><ExerciseArt exercise={exercise}/><div className="fake-player"><button>▶</button><i><b /></i><span>0:00 / 0:10</span><button>1x</button></div></div>
            <div className="view-toggle"><button>Front</button><button className="active">Side</button><button>Top</button></div>
            <ol className="step-list">{steps.map((step,i) => <li key={step}><span>{i+1}</span>{step}</li>)}</ol>
          </>
        ) : null}
        {tab === "muscles" ? (
          <>
            <MuscleMap exercise={exercise}/>
            <div className="muscle-info"><span><i className="primary-dot"/>Primary</span><span><i className="secondary-dot"/>Secondary</span></div>
            <h3>Muscles worked</h3><div className="muscle-chips"><span>{exercise.target} (Primary)</span><span>Stabilizers (Secondary)</span></div>
            <h3>Equipment</h3><div className="equipment-chip">{exercise.equipment[0]}</div>
            <h3>Alternatives</h3><div className="alternatives-grid">{exercise.alternatives.slice(0,3).map((alt) => <div key={alt}><ExerciseArt exercise={exercise} compact/><span>{alt}</span></div>)}</div>
          </>
        ) : null}
        {tab === "steps" ? <ol className="step-list full-steps">{steps.map((step,i) => <li key={step}><span>{i+1}</span>{step}</li>)}</ol> : null}
      </div>
    </div>
  );
}

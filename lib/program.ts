export type Equipment =
  | "Dumbbells"
  | "Cable station"
  | "Shoulder press machine"
  | "Incline press machine"
  | "Lat pulldown"
  | "Row machine"
  | "Pec deck / reverse pec deck"
  | "Leg press"
  | "Seated leg curl"
  | "Leg extension"
  | "Hip thrust / glute drive"
  | "Calf machine"
  | "Bench";

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  minRep: number;
  maxRep: number;
  rir: string;
  restSec: number;
  target: string;
  cue: string;
  why: string;
  equipment: Equipment[];
  alternatives: string[];
  demoUrl: string;
  loadStep: number;
  priority?: boolean;
};

export type Session = {
  id: "A" | "B" | "C" | "D";
  title: string;
  subtitle: string;
  required: boolean;
  duration: string;
  exercises: Exercise[];
};

const mw = (slug: string) => "https://musclewiki.com/exercise/" + slug;

export const allEquipment: Equipment[] = [
  "Dumbbells",
  "Cable station",
  "Shoulder press machine",
  "Incline press machine",
  "Lat pulldown",
  "Row machine",
  "Pec deck / reverse pec deck",
  "Leg press",
  "Seated leg curl",
  "Leg extension",
  "Hip thrust / glute drive",
  "Calf machine",
  "Bench",
];

export const defaultEquipment = allEquipment;

export const sessions: Session[] = [
  {
    id: "A",
    title: "Upper — Strength + Width",
    subtitle: "Shoulders, upper chest and lats first while you are fresh.",
    required: true,
    duration: "65–75 min",
    exercises: [
      {
        id: "press",
        name: "Machine or Dumbbell Shoulder Press",
        sets: 3, reps: "5–8", minRep: 5, maxRep: 8, rir: "2 RIR", restSec: 180,
        target: "Delts + triceps",
        cue: "Brace, use a pain-free path, and stop before technique changes.",
        why: "A stable heavy press gives us a measurable strength anchor while adding delt volume.",
        equipment: ["Shoulder press machine", "Dumbbells", "Bench"],
        alternatives: ["Neutral-grip machine press", "Landmine press", "Single-arm neutral dumbbell press"],
        demoUrl: mw("dumbbell-single-arm-neutral-overhead-press"),
        loadStep: 2.5, priority: true
      },
      {
        id: "incline",
        name: "Incline Dumbbell or Machine Press",
        sets: 3, reps: "6–10", minRep: 6, maxRep: 10, rir: "1–2 RIR", restSec: 180,
        target: "Upper chest + front delts",
        cue: "Use a low/moderate incline and control the bottom position.",
        why: "Builds the upper torso efficiently without needing maximal barbell loading.",
        equipment: ["Dumbbells", "Bench", "Incline press machine"],
        alternatives: ["Incline machine press", "Low-incline dumbbell press", "Cable press"],
        demoUrl: mw("dumbbell-incline-bench-press"),
        loadStep: 2.5
      },
      {
        id: "pulldown",
        name: "Neutral-Grip Lat Pulldown",
        sets: 3, reps: "6–10", minRep: 6, maxRep: 10, rir: "1–2 RIR", restSec: 150,
        target: "Lats + upper back",
        cue: "Drive elbows toward your hips; avoid swinging.",
        why: "Lat growth adds upper-body width and balances the pressing work.",
        equipment: ["Lat pulldown", "Cable station"],
        alternatives: ["Assisted pull-up", "Single-arm cable pulldown", "Machine pullover"],
        demoUrl: "https://musclewiki.com/exercises/lats/cables",
        loadStep: 2.5, priority: true
      },
      {
        id: "row",
        name: "Chest-Supported Row",
        sets: 3, reps: "8–12", minRep: 8, maxRep: 12, rir: "1–2 RIR", restSec: 120,
        target: "Mid-back + rear delts",
        cue: "Keep chest supported and pull without torso heave.",
        why: "Stable rowing builds upper-back thickness with less lower-back fatigue.",
        equipment: ["Row machine", "Dumbbells", "Bench"],
        alternatives: ["Seated cable row", "Machine row", "Incline-bench dumbbell row"],
        demoUrl: "https://musclewiki.com/exercises/upper-back/machine",
        loadStep: 2.5
      },
      {
        id: "latraiseA",
        name: "Cable Lateral Raise",
        sets: 4, reps: "10–20", minRep: 10, maxRep: 20, rir: "1 RIR", restSec: 90,
        target: "Lateral delts",
        cue: "Lead with the elbow, keep the torso quiet, and avoid shrugging.",
        why: "This is the highest-priority direct movement for visually wider shoulders.",
        equipment: ["Cable station"],
        alternatives: ["Lateral-raise machine", "Dumbbell lateral raise"],
        demoUrl: mw("cable-low-single-arm-lateral-raise"),
        loadStep: 1.25, priority: true
      },
      {
        id: "rearA",
        name: "Reverse Pec Deck",
        sets: 3, reps: "12–20", minRep: 12, maxRep: 20, rir: "1 RIR", restSec: 90,
        target: "Rear delts",
        cue: "Move through the shoulder and keep the traps from taking over.",
        why: "Rear-delt work adds shoulder roundness and helps balance pressing volume.",
        equipment: ["Pec deck / reverse pec deck"],
        alternatives: ["Cable reverse fly", "Chest-supported rear-delt fly", "Face pull"],
        demoUrl: "https://musclewiki.com/exercises/rear-shoulders/machine",
        loadStep: 2.5, priority: true
      },
      {
        id: "shrugA",
        name: "Machine or Dumbbell Shrug",
        sets: 2, reps: "8–15", minRep: 8, maxRep: 15, rir: "1–2 RIR", restSec: 90,
        target: "Upper traps",
        cue: "Elevate straight up, pause briefly, and do not roll the shoulders.",
        why: "A modest trap dose can make the shoulder girdle look more substantial without stealing volume from the delts.",
        equipment: ["Dumbbells"],
        alternatives: ["Machine shrug", "Cable shrug"],
        demoUrl: "https://musclewiki.com/exercises/traps/dumbbells",
        loadStep: 5
      }
    ]
  },
  {
    id: "B",
    title: "Lower — Joint-Friendly Strength + Growth",
    subtitle: "Grow the legs with stable exercises and no ego lifting.",
    required: true,
    duration: "55–70 min",
    exercises: [
      {
        id: "legpress",
        name: "Leg Press",
        sets: 3, reps: "6–10", minRep: 6, maxRep: 10, rir: "2 RIR", restSec: 180,
        target: "Quads + glutes",
        cue: "Use a comfortable stance and pain-free depth; keep the pelvis controlled.",
        why: "A stable compound that loads the legs hard without making a heavy barbell squat mandatory.",
        equipment: ["Leg press"],
        alternatives: ["Hack squat machine if comfortable", "Belt squat", "Supported split squat"],
        demoUrl: mw("machine-leg-press"),
        loadStep: 5, priority: true
      },
      {
        id: "curlB",
        name: "Seated Leg Curl",
        sets: 3, reps: "8–12", minRep: 8, maxRep: 12, rir: "1–2 RIR", restSec: 120,
        target: "Hamstrings",
        cue: "Keep hips pinned and control the stretched position.",
        why: "High hamstring stimulus with little balance or spinal demand.",
        equipment: ["Seated leg curl"],
        alternatives: ["Lying leg curl", "Standing single-leg curl", "Controlled dumbbell RDL if comfortable"],
        demoUrl: mw("seated-leg-curl"),
        loadStep: 2.5, priority: true
      },
      {
        id: "hip",
        name: "Hip Thrust / Glute Drive",
        sets: 3, reps: "8–12", minRep: 8, maxRep: 12, rir: "1–2 RIR", restSec: 150,
        target: "Glutes + hip extensors",
        cue: "Finish with the glutes and avoid hyperextending the lower back.",
        why: "Trains hip extension hard without requiring conventional deadlifts.",
        equipment: ["Hip thrust / glute drive", "Bench"],
        alternatives: ["45° back extension if comfortable", "Cable pull-through", "Dumbbell hip thrust"],
        demoUrl: mw("machine-plate-loaded-hip-thrust"),
        loadStep: 5
      },
      {
        id: "extensionB",
        name: "Leg Extension",
        sets: 3, reps: "10–15", minRep: 10, maxRep: 15, rir: "1–2 RIR", restSec: 105,
        target: "Quads",
        cue: "Use smooth reps in a comfortable range and never force joint pain.",
        why: "Adds quad volume efficiently without much whole-body fatigue.",
        equipment: ["Leg extension"],
        alternatives: ["Belt squat", "Supported step-up", "Band leg extension"],
        demoUrl: mw("machine-plate-loaded-leg-extension"),
        loadStep: 2.5
      },
      {
        id: "calf",
        name: "Seated or Supported Calf Raise",
        sets: 3, reps: "8–15", minRep: 8, maxRep: 15, rir: "1–2 RIR", restSec: 90,
        target: "Calves",
        cue: "Pause in a comfortable stretch and avoid bouncing.",
        why: "Direct lower-leg work with low balance demand.",
        equipment: ["Calf machine"],
        alternatives: ["Leg-press calf raise", "Dumbbell seated calf raise"],
        demoUrl: mw("dumbbell-seated-calf-raise"),
        loadStep: 2.5
      }
    ]
  },
  {
    id: "C",
    title: "Upper + Lower Top-Up — Hypertrophy",
    subtitle: "Second weekly width stimulus plus efficient leg volume.",
    required: true,
    duration: "60–75 min",
    exercises: [
      {
        id: "singlelat",
        name: "Single-Arm Cable Lat Pulldown",
        sets: 3, reps: "8–12", minRep: 8, maxRep: 12, rir: "1–2 RIR", restSec: 120,
        target: "Lats",
        cue: "Reach comfortably and pull the elbow toward the hip.",
        why: "A second lat exposure distributes productive weekly volume.",
        equipment: ["Cable station"],
        alternatives: ["Lat pulldown", "Assisted pull-up", "Machine pullover"],
        demoUrl: "https://musclewiki.com/exercises/lats/cables",
        loadStep: 2.5, priority: true
      },
      {
        id: "inclineC",
        name: "Incline Machine Press",
        sets: 3, reps: "8–12", minRep: 8, maxRep: 12, rir: "1–2 RIR", restSec: 150,
        target: "Upper chest + front delts",
        cue: "Set the shoulders, keep the path stable, and control the eccentric.",
        why: "Keeps upper-chest frequency high using a stable setup.",
        equipment: ["Incline press machine"],
        alternatives: ["Low-incline dumbbell press", "Cable press"],
        demoUrl: mw("dumbbell-incline-bench-press"),
        loadStep: 2.5
      },
      {
        id: "rowC",
        name: "Seated Cable or Machine Row",
        sets: 3, reps: "8–12", minRep: 8, maxRep: 12, rir: "1–2 RIR", restSec: 120,
        target: "Upper back + rear delts",
        cue: "Stay tall and drive the elbows back without yanking.",
        why: "Adds back volume without another free-weight hinge.",
        equipment: ["Row machine", "Cable station"],
        alternatives: ["Chest-supported dumbbell row", "Machine row"],
        demoUrl: "https://musclewiki.com/exercises/upper-back/cables",
        loadStep: 2.5
      },
      {
        id: "latraiseC",
        name: "Cable Lateral Raise",
        sets: 4, reps: "12–20", minRep: 12, maxRep: 20, rir: "0–1 RIR final set", restSec: 90,
        target: "Lateral delts",
        cue: "Use the same setup weekly and avoid torso swing.",
        why: "The second direct lateral-delt exposure brings the baseline to eight high-quality direct sets.",
        equipment: ["Cable station"],
        alternatives: ["Lateral-raise machine", "Dumbbell lateral raise"],
        demoUrl: mw("cable-low-single-arm-lateral-raise"),
        loadStep: 1.25, priority: true
      },
      {
        id: "rearC",
        name: "Reverse Pec Deck",
        sets: 2, reps: "12–20", minRep: 12, maxRep: 20, rir: "1 RIR", restSec: 90,
        target: "Rear delts",
        cue: "Keep the shoulders down and do not turn it into a row.",
        why: "Second rear-delt exposure at a low systemic-fatigue cost.",
        equipment: ["Pec deck / reverse pec deck"],
        alternatives: ["Cable reverse fly", "Chest-supported rear-delt fly", "Face pull"],
        demoUrl: "https://musclewiki.com/exercises/rear-shoulders/machine",
        loadStep: 2.5
      },
      {
        id: "extensionC",
        name: "Leg Extension",
        sets: 2, reps: "10–15", minRep: 10, maxRep: 15, rir: "1–2 RIR", restSec: 105,
        target: "Quads",
        cue: "Smooth reps in a pain-free range only.",
        why: "A small second quad dose without another demanding lower session.",
        equipment: ["Leg extension"],
        alternatives: ["Belt squat", "Supported step-up", "Band leg extension"],
        demoUrl: mw("machine-plate-loaded-leg-extension"),
        loadStep: 2.5
      },
      {
        id: "curlC",
        name: "Seated Leg Curl",
        sets: 2, reps: "10–15", minRep: 10, maxRep: 15, rir: "1–2 RIR", restSec: 105,
        target: "Hamstrings",
        cue: "Keep the hips planted and control every rep.",
        why: "A second hamstring exposure with a low fatigue cost.",
        equipment: ["Seated leg curl"],
        alternatives: ["Lying leg curl", "Standing single-leg curl"],
        demoUrl: mw("seated-leg-curl"),
        loadStep: 2.5
      }
    ]
  },
  {
    id: "D",
    title: "Optional — Delts, Traps, Arms + Leg Pump",
    subtitle: "Only when recovered. Bonus volume, never a missing piece.",
    required: false,
    duration: "45–60 min",
    exercises: [
      {
        id: "latraiseD",
        name: "Lateral-Raise Machine or Cable",
        sets: 3, reps: "12–20", minRep: 12, maxRep: 20, rir: "1 RIR", restSec: 90,
        target: "Lateral delts",
        cue: "Stable torso; lead with the elbow.",
        why: "Adds priority-muscle volume only when recovery is good.",
        equipment: ["Cable station"],
        alternatives: ["Lateral-raise machine", "Dumbbell lateral raise"],
        demoUrl: mw("cable-low-bilateral-lateral-raise"),
        loadStep: 1.25, priority: true
      },
      {
        id: "rearD",
        name: "Reverse Pec Deck",
        sets: 2, reps: "15–20", minRep: 15, maxRep: 20, rir: "1 RIR", restSec: 90,
        target: "Rear delts",
        cue: "No shrugging; use a smooth arc.",
        why: "Extra rear-delt volume with little systemic fatigue.",
        equipment: ["Pec deck / reverse pec deck"],
        alternatives: ["Cable reverse fly", "Face pull"],
        demoUrl: "https://musclewiki.com/exercises/rear-shoulders/machine",
        loadStep: 2.5
      },
      {
        id: "shrugD",
        name: "Machine or Dumbbell Shrug",
        sets: 2, reps: "10–15", minRep: 10, maxRep: 15, rir: "1–2 RIR", restSec: 90,
        target: "Upper traps",
        cue: "Straight up and down, with a brief pause at the top.",
        why: "Optional trap volume for a fuller shoulder-to-neck silhouette.",
        equipment: ["Dumbbells"],
        alternatives: ["Machine shrug", "Cable shrug"],
        demoUrl: "https://musclewiki.com/exercises/traps/dumbbells",
        loadStep: 5
      },
      {
        id: "legpressD",
        name: "Light / Moderate Leg Press",
        sets: 2, reps: "10–15", minRep: 10, maxRep: 15, rir: "2 RIR", restSec: 120,
        target: "Quads + glutes",
        cue: "Use pain-free depth and avoid grinding.",
        why: "Useful extra leg volume that is intentionally lighter than Session B.",
        equipment: ["Leg press"],
        alternatives: ["Belt squat", "Supported split squat"],
        demoUrl: mw("machine-leg-press"),
        loadStep: 5
      },
      {
        id: "curlD",
        name: "Seated Leg Curl",
        sets: 2, reps: "12–15", minRep: 12, maxRep: 15, rir: "1–2 RIR", restSec: 90,
        target: "Hamstrings",
        cue: "Control the stretched position.",
        why: "Low-fatigue hamstring volume.",
        equipment: ["Seated leg curl"],
        alternatives: ["Lying leg curl", "Standing single-leg curl"],
        demoUrl: mw("seated-leg-curl"),
        loadStep: 2.5
      },
      {
        id: "biceps",
        name: "Cable Curl",
        sets: 2, reps: "8–15", minRep: 8, maxRep: 15, rir: "1 RIR", restSec: 90,
        target: "Biceps",
        cue: "Keep elbows stable and avoid torso swing.",
        why: "A small direct arm dose after priority work.",
        equipment: ["Cable station"],
        alternatives: ["Dumbbell curl", "Machine curl"],
        demoUrl: "https://musclewiki.com/exercises/biceps/cables",
        loadStep: 1.25
      },
      {
        id: "triceps",
        name: "Cable Triceps Pressdown",
        sets: 2, reps: "8–15", minRep: 8, maxRep: 15, rir: "1 RIR", restSec: 90,
        target: "Triceps",
        cue: "Keep the upper arm still and control the return.",
        why: "Efficient direct triceps work after the priority work.",
        equipment: ["Cable station"],
        alternatives: ["Machine dip", "Dumbbell overhead extension"],
        demoUrl: "https://musclewiki.com/exercises/triceps/cables",
        loadStep: 1.25
      }
    ]
  }
];

export const weeklyDirectSets = [
  ["Lateral delts", "8 baseline / 11 with D"],
  ["Rear delts", "5 baseline / 7 with D"],
  ["Upper traps", "2 baseline / 4 with D"],
  ["Lats / upper back", "12+ across A + C"],
  ["Quads", "9 baseline / 11 with D"],
  ["Hamstrings", "7 baseline / 9 with D"]
];

export const principles = [
  ["Double progression", "Keep the exercise and load stable until you reach the top of the rep range across the working sets at the planned RIR, then add a small amount of weight."],
  ["Hard sets, not junk sets", "Most working sets stop 1–2 reps before failure. Isolation work may reach 0–1 RIR on the last set if technique stays clean."],
  ["Stable exercise selection", "Do not rotate movements just for novelty. Repeating the same lifts makes progressive overload measurable."],
  ["Full, controlled ROM", "Use the largest comfortable range you can control. Pain-free technique outranks chasing a textbook depth."],
  ["Recoverable volume", "Session D is optional. Add it only when the previous sessions and your other training are being recovered from well."],
  ["No mandatory lift", "If an exercise aggravates a joint, replace it with a movement that trains the same target with less irritation."]
];

export const mealIdeas = [
  "Chicken + rice + tomato stew + vegetables",
  "Chicken curry + rice + mixed vegetables",
  "Egusi soup + lean protein; keep oil and swallow portion deliberate",
  "Jollof rice + grilled chicken or fish + vegetables",
  "Beans + rice + fish or chicken",
  "Eggs + oats or whole-grain bread + fruit",
  "Greek yogurt / skyr + fruit + oats"
];

export const science = [
  {
    title: "Weekly volume",
    text: "Higher weekly set volume generally improves hypertrophy, but returns diminish. The baseline gives priority muscles enough direct work without making the optional day mandatory.",
    url: "https://pubmed.ncbi.nlm.nih.gov/41843416/"
  },
  {
    title: "Proximity to failure",
    text: "Hard sets matter, but every set does not need to be absolute failure. Most work stays around 1–2 reps in reserve so performance and recovery remain repeatable.",
    url: "https://pubmed.ncbi.nlm.nih.gov/38970765/"
  },
  {
    title: "Rest intervals",
    text: "Rushing sets can reduce productive repetitions. Compounds get roughly 2–3 minutes; isolations usually 90–120 seconds.",
    url: "https://pubmed.ncbi.nlm.nih.gov/39205815/"
  },
  {
    title: "Load selection",
    text: "Muscle can be built across a broad loading range; heavier work is useful for strength while moderate and higher reps can grow muscle with less joint loading.",
    url: "https://pubmed.ncbi.nlm.nih.gov/35015560/"
  }
];

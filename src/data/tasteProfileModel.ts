// Lightweight model weights exported from ml/train_taste_profile.py.
// The app runs this tiny model in the browser instead of shipping PyTorch to Vercel.

export type TasteProfileLabel =
  | "budget_commuter"
  | "budget_first"
  | "convenience"
  | "lease_planner"
  | "comfort"
  | "balanced"
  | "space_hunter"
  | "bathroom_planner";

type FeatureVector = Record<string, number>;

const featureNames = [
  "budgetPriority",
  "commutePriority",
  "leasePriority",
  "bedroomsPriority",
  "squareFeetPriority",
  "bathsPriority",
  "amenitiesPriority",
  "strictBudget",
  "strictCommute",
  "leaseSet",
  "bedroomNeed",
  "squareFeetNeed",
  "bathNeed",
  "amenityNeed",
  "priceChart",
  "commuteChart",
  "leaseChart",
  "bedroomChart",
  "squareFeetChart",
  "bathChart",
  "explanationActivity",
  "pagingActivity",
];

const profileWeights: Record<TasteProfileLabel, number[]> = {
  budget_commuter: [
    1.5, 2, 0.4, 0.2, 0.1, 0.1, 0.3, 1.2, 1.7, 0.1, 0.1, 0.05, 0.05, 0.2,
    0.8, 1.3, 0, 0, 0, 0, 0.4, 0.3,
  ],
  budget_first: [
    2.8, -0.4, 0.3, 0.2, 0.05, 0.05, 0.2, 2.4, -0.6, 0, 0.1, 0, 0, 0.1, 2,
    -0.5, 0, 0, 0, 0, 0.3, 0.2,
  ],
  convenience: [
    0.4, 2.2, 0.2, 0.2, 0.1, 0.1, 0.7, 0.1, 1.8, 0, 0, 0.05, 0.05, 0.5,
    0.1, 1.6, 0, 0, 0, 0, 0.3, 0.3,
  ],
  lease_planner: [
    0.3, 0.3, 2.3, 0.2, 0.1, 0.1, 0.2, 0.2, 0.2, 1.8, 0, 0, 0, 0, 0, 0, 1.5,
    0, 0, 0, 0.2, 0.1,
  ],
  comfort: [
    0.2, 0.3, 0.2, 1.2, 1.2, 1, 1.8, 0, 0.2, 0.2, 1.1, 1.1, 0.9, 1.6, 0,
    0.2, 0, 1, 1, 0.8, 0.4, 0.2,
  ],
  balanced: [
    0.9, 0.9, 0.8, 0.75, 0.75, 0.7, 0.8, 0.4, 0.4, 0.4, 0.35, 0.35, 0.3, 0.4,
    0.3, 0.3, 0.3, 0.3, 0.3, 0.25, 0.5, 0.4,
  ],
  space_hunter: [
    0.1, 0.15, 0.1, 0.9, 2.8, 0.5, 0.3, 0, 0.1, 0, 0.7, 2.4, 0.3, 0.2, 0,
    0.1, 0, 0.7, 2.2, 0.3, 0.4, 0.25,
  ],
  bathroom_planner: [
    0.1, 0.15, 0.1, 0.8, 0.4, 2.8, 0.3, 0, 0.1, 0, 0.7, 0.3, 2.5, 0.2, 0,
    0.1, 0, 0.6, 0.3, 2.3, 0.4, 0.25,
  ],
};

const profileBiases: Record<TasteProfileLabel, number> = {
  budget_commuter: -1.5,
  budget_first: -1.15,
  convenience: -1.2,
  lease_planner: -1.1,
  comfort: -1.1,
  balanced: 0.15,
  space_hunter: -1.05,
  bathroom_planner: -1.05,
};

export function predictTasteProfile(features: FeatureVector): TasteProfileLabel {
  let bestProfile: TasteProfileLabel = "balanced";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [profile, weights] of Object.entries(profileWeights) as Array<
    [TasteProfileLabel, number[]]
  >) {
    const score = weights.reduce((sum, weight, index) => {
      return sum + weight * (features[featureNames[index]] ?? 0);
    }, profileBiases[profile]);

    if (score > bestScore) {
      bestScore = score;
      bestProfile = profile;
    }
  }

  return bestProfile;
}

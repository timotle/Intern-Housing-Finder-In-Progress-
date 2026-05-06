export type TasteProfileLabel =
  | "budget_commuter"
  | "budget_first"
  | "convenience"
  | "lease_planner"
  | "comfort"
  | "balanced";

type FeatureVector = Record<string, number>;

const featureNames = [
  "budgetPriority",
  "commutePriority",
  "leasePriority",
  "bedroomsPriority",
  "amenitiesPriority",
  "strictBudget",
  "strictCommute",
  "leaseSet",
  "bedroomNeed",
  "amenityNeed",
  "priceChart",
  "commuteChart",
  "leaseChart",
  "bedroomChart",
  "explanationActivity",
  "pagingActivity",
];

const profileWeights: Record<TasteProfileLabel, number[]> = {
  budget_commuter: [1.8, 1.6, 0.4, 0.2, 0.3, 1.6, 1.3, 0.1, 0.1, 0.2, 1.4, 1.1, 0, 0, 0.4, 0.3],
  budget_first: [2.2, 0.6, 0.3, 0.2, 0.2, 1.8, 0.2, 0, 0.1, 0.1, 1.5, 0.2, 0, 0, 0.3, 0.2],
  convenience: [0.4, 2.2, 0.2, 0.2, 0.7, 0.1, 1.8, 0, 0, 0.5, 0.1, 1.6, 0, 0, 0.3, 0.3],
  lease_planner: [0.3, 0.3, 2.3, 0.2, 0.2, 0.2, 0.2, 1.8, 0, 0, 0, 0, 1.5, 0, 0.2, 0.1],
  comfort: [0.2, 0.3, 0.2, 1.5, 1.8, 0, 0.2, 0.2, 1.4, 1.6, 0, 0.2, 0, 1.3, 0.4, 0.2],
  balanced: [0.9, 0.9, 0.8, 0.8, 0.8, 0.4, 0.4, 0.4, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.5, 0.4],
};

const profileBiases: Record<TasteProfileLabel, number> = {
  budget_commuter: -1.5,
  budget_first: -1.25,
  convenience: -1.2,
  lease_planner: -1.1,
  comfort: -1.1,
  balanced: 0.35,
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

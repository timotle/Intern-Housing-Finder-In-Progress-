"""
PyTorch training script for the housing taste profile feature.

The deployed app does not run PyTorch directly. This script is for training or
refreshing lightweight profile weights locally, then exporting those weights for
the React app to use in src/data/tasteProfileModel.ts. This keeps the website
fast on Vercel while still making the profile logic ML-backed.
"""

from __future__ import annotations

import json
from pathlib import Path

try:
    import torch
    from torch import nn
except ModuleNotFoundError as exc:
    raise SystemExit(
        "PyTorch is not installed. Install torch locally before running this script."
    ) from exc


FEATURES = [
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
]

PROFILES = [
    "budget_commuter",
    "budget_first",
    "convenience",
    "lease_planner",
    "comfort",
    "balanced",
    "space_hunter",
    "bathroom_planner",
]


def row(values: dict[str, float], label: str) -> tuple[list[float], int]:
    return [values.get(feature, 0.0) for feature in FEATURES], PROFILES.index(label)


TRAINING_ROWS = [
    row({"budgetPriority": 1, "commutePriority": 0.8, "strictBudget": 1, "strictCommute": 1, "priceChart": 1}, "budget_commuter"),
    row({"budgetPriority": 1, "strictBudget": 1, "priceChart": 1, "explanationActivity": 0.7}, "budget_first"),
    row({"commutePriority": 1, "strictCommute": 1, "commuteChart": 1, "amenityNeed": 0.6}, "convenience"),
    row({"leasePriority": 1, "leaseSet": 1, "leaseChart": 1}, "lease_planner"),
    row({"bedroomsPriority": 0.9, "amenitiesPriority": 1, "bedroomNeed": 1, "amenityNeed": 1, "bedroomChart": 1}, "comfort"),
    row({"squareFeetPriority": 1, "squareFeetNeed": 1, "squareFeetChart": 1, "bedroomsPriority": 0.5}, "space_hunter"),
    row({"bathsPriority": 1, "bathNeed": 1, "bathChart": 1, "bedroomsPriority": 0.4}, "bathroom_planner"),
    row({"budgetPriority": 0.8, "commutePriority": 0.8, "leasePriority": 0.7, "squareFeetPriority": 0.5, "bathsPriority": 0.5, "amenitiesPriority": 0.6, "pagingActivity": 0.6}, "balanced"),
]


def main() -> None:
    x = torch.tensor([features for features, _label in TRAINING_ROWS], dtype=torch.float32)
    y = torch.tensor([label for _features, label in TRAINING_ROWS], dtype=torch.long)

    model = nn.Linear(len(FEATURES), len(PROFILES))
    optimizer = torch.optim.Adam(model.parameters(), lr=0.05)
    loss_fn = nn.CrossEntropyLoss()

    for _ in range(500):
        optimizer.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        optimizer.step()

    weights = model.weight.detach().tolist()
    biases = model.bias.detach().tolist()
    export = {
        "features": FEATURES,
        "profiles": PROFILES,
        "weights": weights,
        "biases": biases,
    }

    output_path = Path(__file__).with_name("taste_profile_export.json")
    output_path.write_text(json.dumps(export, indent=2), encoding="utf-8")
    print(f"Exported profile model to {output_path}")


if __name__ == "__main__":
    main()

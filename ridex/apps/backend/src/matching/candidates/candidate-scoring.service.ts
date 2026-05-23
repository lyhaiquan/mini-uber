import { Injectable } from "@nestjs/common";

import type { CandidateScoreInput } from "../matching.types";
import {
  DISTANCE_NORMALIZATION_METERS,
  ETA_NORMALIZATION_SECONDS,
  LOW_CONFIDENCE_SCORE_PENALTY
} from "../matching.constants";

export interface MatchingScoreWeights {
  distanceWeight: number;
  etaWeight: number;
}

@Injectable()
export class CandidateScoringService {
  score(input: CandidateScoreInput, weights: MatchingScoreWeights): number {
    const normalizedDistance = input.distanceMeters / DISTANCE_NORMALIZATION_METERS;
    const normalizedEta = input.durationSeconds / ETA_NORMALIZATION_SECONDS;
    const confidencePenalty =
      input.confidence === "low" ? LOW_CONFIDENCE_SCORE_PENALTY : 0;

    return (
      weights.distanceWeight * normalizedDistance +
      weights.etaWeight * normalizedEta +
      confidencePenalty
    );
  }
}


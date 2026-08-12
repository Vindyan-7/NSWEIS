import type { WellnessBand, WellnessCategory, WellnessTrend } from '../../types/domain';

export interface ScoreResult {
  category: WellnessCategory;
  score: number; // 0.0 to 10.0
  band: WellnessBand;
}

export function scoreToBand(score: number): WellnessBand {
  if (score >= 8.0) return 'stable';
  if (score >= 6.0) return 'watch';
  if (score >= 4.0) return 'needs_attention';
  return 'elevated';
}

export function calculateTrend(
  currentScore: number,
  previousScore?: number | null
): WellnessTrend {
  if (previousScore === undefined || previousScore === null) {
    return 'first_check_in';
  }
  const delta = currentScore - previousScore;
  if (delta > 0.3) return 'improving';
  if (delta < -0.3) return 'declining';
  return 'stable';
}

export function calculateCategoryScores(
  responses: Array<{ category: WellnessCategory; score: number; weight: number }>
): ScoreResult[] {
  const categoryTotals: Record<string, { totalScore: number; totalWeight: number }> = {};

  for (const r of responses) {
    if (!categoryTotals[r.category]) {
      categoryTotals[r.category] = { totalScore: 0, totalWeight: 0 };
    }
    categoryTotals[r.category].totalScore += r.score * r.weight;
    categoryTotals[r.category].totalWeight += r.weight;
  }

  const results: ScoreResult[] = [];
  for (const [cat, data] of Object.entries(categoryTotals)) {
    const finalScore = data.totalWeight > 0 ? data.totalScore / data.totalWeight : 5.0;
    const roundedScore = Math.round(finalScore * 10) / 10;
    results.push({
      category: cat as WellnessCategory,
      score: roundedScore,
      band: scoreToBand(roundedScore),
    });
  }

  return results;
}

export function calculateOverallIndicator(categoryScores: ScoreResult[]): {
  overallScore: number;
  overallBand: WellnessBand;
} {
  if (categoryScores.length === 0) {
    return { overallScore: 5.0, overallBand: 'needs_attention' };
  }

  const total = categoryScores.reduce((sum, item) => sum + item.score, 0);
  const overallScore = Math.round((total / categoryScores.length) * 10) / 10;
  return {
    overallScore,
    overallBand: scoreToBand(overallScore),
  };
}

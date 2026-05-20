export function formatSimilarityScore(score: number): string {
	if (score >= 0 && score <= 1) return `${(score * 100).toFixed(0)}%`
	return Number.isInteger(score) ? String(score) : score.toFixed(2)
}

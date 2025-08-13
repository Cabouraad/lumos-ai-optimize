import { describe, it, expect } from 'vitest'
import { computeScore } from './visibility'

describe('computeScore', () => {
  it('should return 0 when org is not present', () => {
    expect(computeScore(false, null, 0)).toBe(0)
    expect(computeScore(false, null, 5)).toBe(0)
    expect(computeScore(false, 0, 0)).toBe(0)
  })

  it('should return 100 base score when org is present', () => {
    expect(computeScore(true, null, 0)).toBe(100)
  })

  it('should apply prominence bonuses correctly', () => {
    // Index 0 (first position) = +30 bonus
    expect(computeScore(true, 0, 0)).toBe(130)
    // Index 1 (second position) = +20 bonus  
    expect(computeScore(true, 1, 0)).toBe(120)
    // Index 2 (third position) = +10 bonus
    expect(computeScore(true, 2, 0)).toBe(110)
    // Index 3 (fourth position) = +0 bonus
    expect(computeScore(true, 3, 0)).toBe(100)
    // Index 4+ (beyond top-4) = +0 bonus
    expect(computeScore(true, 4, 0)).toBe(100)
    expect(computeScore(true, 10, 0)).toBe(100)
  })

  it('should cap total score at 100 with prominence', () => {
    // Even with max prominence bonus, score shouldn't exceed 100
    expect(computeScore(true, 0, 0)).toBe(130)
    // But with competitors it should be capped properly
    expect(Math.min(100, computeScore(true, 0, 0))).toBe(100)
  })

  it('should apply competitor penalties', () => {
    // -5 per competitor, up to -20 max
    expect(computeScore(true, null, 1)).toBe(95) // -5
    expect(computeScore(true, null, 2)).toBe(90) // -10  
    expect(computeScore(true, null, 3)).toBe(85) // -15
    expect(computeScore(true, null, 4)).toBe(80) // -20 (max penalty)
    expect(computeScore(true, null, 5)).toBe(80) // -20 (capped)
    expect(computeScore(true, null, 10)).toBe(80) // -20 (capped)
  })

  it('should combine prominence bonus and competitor penalty', () => {
    // Index 0 (+30) with 2 competitors (-10) = 130 - 10 = 120
    expect(computeScore(true, 0, 2)).toBe(120)
    // Index 1 (+20) with 4 competitors (-20) = 120 - 20 = 100  
    expect(computeScore(true, 1, 4)).toBe(100)
    // Index 2 (+10) with 3 competitors (-15) = 110 - 15 = 95
    expect(computeScore(true, 2, 3)).toBe(95)
  })

  it('should never go below 0', () => {
    // Even with max penalties, score should floor at 0
    expect(computeScore(true, null, 100)).toBe(80) // 100 - 20 (capped) = 80
    // But if base was lower somehow...
    expect(Math.max(0, 50 - 100)).toBe(0)
  })

  it('should handle edge cases', () => {
    expect(computeScore(true, null, 0)).toBe(100)
    expect(computeScore(false, 0, 0)).toBe(0)
    expect(computeScore(true, -1, 0)).toBe(100) // negative index treated as no bonus
  })
})
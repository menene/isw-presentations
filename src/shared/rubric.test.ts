import { describe, expect, it } from 'vitest'
import { groups } from './groups'
import { criteria, isValidRatings, maxTotalCents, pointsForLevel, totalCents } from './rubric'

describe('presentation rubric', () => {
  it('matches the eight-point rubric at every level', () => {
    expect(criteria).toHaveLength(8)
    expect(maxTotalCents).toBe(800)
    expect(totalCents(Array(8).fill(0))).toBe(0)
    expect(totalCents(Array(8).fill(4))).toBe(800)
    expect(totalCents(Array(8).fill(3))).toBe(600)
    expect(pointsForLevel(criteria[3], 2)).toBe(128)
  })

  it('rejects missing, fractional, or out-of-range levels', () => {
    expect(isValidRatings(Array(8).fill(2))).toBe(true)
    expect(isValidRatings(Array(7).fill(2))).toBe(false)
    expect(isValidRatings([0, 1, 2, 3, 4, 1.5, 2, 3])).toBe(false)
    expect(isValidRatings([0, 1, 2, 3, 4, 5, 2, 3])).toBe(false)
  })

  it('has 21 distinct section and group identifiers', () => {
    expect(groups).toHaveLength(21)
    expect(new Set(groups.map((group) => group.id)).size).toBe(21)
  })
})

import { describe, it, expect } from 'vitest'
import { normalize, isOrgBrand } from './match'

describe('normalize', () => {
  it('should lowercase strings', () => {
    expect(normalize('ACME Corp')).toBe('acme corp')
  })

  it('should remove punctuation', () => {
    expect(normalize('Acme, Inc.')).toBe('acme inc')
    expect(normalize('Test-Co!')).toBe('testco')
  })

  it('should normalize spaces', () => {
    expect(normalize('  Multiple   Spaces  ')).toBe('multiple spaces')
  })

  it('should handle complex cases', () => {
    expect(normalize('  ACME, Inc.  &  Co.  ')).toBe('acme inc co')
  })
})

describe('isOrgBrand', () => {
  const mockCatalog = [
    { name: 'Acme Corp', variants_json: ['Acme', 'Acme Inc', 'ACME Company'] },
    { name: 'TechCorp', variants_json: ['Tech Corp', 'TechCo'] },
  ]

  it('should match exact brand name', () => {
    expect(isOrgBrand('Acme Corp', mockCatalog)).toBe(true)
    expect(isOrgBrand('ACME CORP', mockCatalog)).toBe(true)
  })

  it('should match exact variants', () => {
    expect(isOrgBrand('Acme', mockCatalog)).toBe(true)
    expect(isOrgBrand('ACME INC', mockCatalog)).toBe(true)
    expect(isOrgBrand('Tech Corp', mockCatalog)).toBe(true)
  })

  it('should match when brand is contained in token', () => {
    expect(isOrgBrand('Acme Corp Solutions', mockCatalog)).toBe(true)
    expect(isOrgBrand('Visit TechCorp website', mockCatalog)).toBe(true)
  })

  it('should match when token starts with brand', () => {
    expect(isOrgBrand('TechCorp Inc', mockCatalog)).toBe(true)
  })

  it('should reject very short strings to avoid false positives', () => {
    expect(isOrgBrand('A', [{ name: 'A', variants_json: [] }])).toBe(false)
    expect(isOrgBrand('ABC', [{ name: 'ABC', variants_json: [] }])).toBe(false)
  })

  it('should not match unrelated brands', () => {
    expect(isOrgBrand('Google', mockCatalog)).toBe(false)
    expect(isOrgBrand('Microsoft', mockCatalog)).toBe(false)
  })

  it('should handle empty catalog', () => {
    expect(isOrgBrand('Acme', [])).toBe(false)
  })

  it('should handle punctuation in tokens', () => {
    expect(isOrgBrand('Acme, Corp.', mockCatalog)).toBe(true)
    expect(isOrgBrand('Visit tech-corp.com!', mockCatalog)).toBe(true)
  })
})
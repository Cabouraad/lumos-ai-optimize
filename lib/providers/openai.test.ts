import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractBrands } from './openai'

// Mock fetch globally
global.fetch = vi.fn()

describe('extractBrands OpenAI', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should extract brands from valid JSON response', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"brands": ["Apple", "Google", "Microsoft"]}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 20 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: ['Apple', 'Google', 'Microsoft'],
      tokenIn: 50,
      tokenOut: 20
    })

    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"model":"gpt-4.1-2025-04-14"')
    })
  })

  it('should handle response without usage data', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"brands": ["Tesla"]}' } }]
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: ['Tesla'],
      tokenIn: 0,
      tokenOut: 0
    })
  })

  it('should fallback to regex parsing when JSON parsing fails', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Here are the brands: ["Netflix", "Spotify"]' } }],
      usage: { prompt_tokens: 30, completion_tokens: 15 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: ['Netflix', 'Spotify'],
      tokenIn: 30,
      tokenOut: 15
    })
  })

  it('should handle empty brands array', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"brands": []}' } }],
      usage: { prompt_tokens: 25, completion_tokens: 5 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: [],
      tokenIn: 25,
      tokenOut: 5
    })
  })

  it('should handle API error responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401
    } as Response)

    await expect(extractBrands('test prompt', 'invalid-key'))
      .rejects.toThrow('OpenAI API error: 401')
  })

  it('should handle malformed responses gracefully', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'This is not JSON at all' } }],
      usage: { prompt_tokens: 20, completion_tokens: 10 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: [],
      tokenIn: 0,
      tokenOut: 0
    })
  })

  it('should handle non-array brands field', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"brands": "not an array"}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 8 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: [],
      tokenIn: 15,
      tokenOut: 8
    })
  })
})
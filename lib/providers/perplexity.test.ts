import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractBrands } from './perplexity'

// Mock fetch globally
global.fetch = vi.fn()

describe('extractBrands Perplexity', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should extract brands from valid JSON response', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"brands": ["Amazon", "Meta", "OpenAI"]}' } }],
      usage: { prompt_tokens: 40, completion_tokens: 18 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: ['Amazon', 'Meta', 'OpenAI'],
      tokenIn: 40,
      tokenOut: 18
    })

    expect(fetch).toHaveBeenCalledWith('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-api-key',
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('"model":"llama-3.1-sonar-small-128k-online"')
    })
  })

  it('should handle response without usage data', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"brands": ["Anthropic"]}' } }]
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: ['Anthropic'],
      tokenIn: 0,
      tokenOut: 0
    })
  })

  it('should fallback to regex parsing when JSON parsing fails', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'The brands mentioned are: ["Uber", "Airbnb"]' } }],
      usage: { prompt_tokens: 35, completion_tokens: 12 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const result = await extractBrands('test prompt', 'test-api-key')

    expect(result).toEqual({
      brands: ['Uber', 'Airbnb'],
      tokenIn: 35,
      tokenOut: 12
    })
  })

  it('should handle API error responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429
    } as Response)

    await expect(extractBrands('test prompt', 'invalid-key'))
      .rejects.toThrow('Perplexity API error: 429')
  })

  it('should handle request configuration correctly', async () => {
    const mockResponse = {
      choices: [{ message: { content: '{"brands": []}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 }
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    await extractBrands('test prompt', 'test-api-key')

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const requestBody = JSON.parse(callArgs[1]?.body as string)

    expect(requestBody).toMatchObject({
      model: 'llama-3.1-sonar-small-128k-online',
      temperature: 0.1,
      max_tokens: 1000,
      return_images: false,
      return_related_questions: false,
      messages: [
        {
          role: 'system',
          content: 'You are an extraction API. Given a user prompt, output ONLY a JSON object with a single key brands as an array of brand or company names you would include in your answer. No explanations.'
        },
        {
          role: 'user',
          content: 'test prompt'
        }
      ]
    })
  })

  it('should handle completely malformed responses', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Error: Unable to process request' } }]
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
})
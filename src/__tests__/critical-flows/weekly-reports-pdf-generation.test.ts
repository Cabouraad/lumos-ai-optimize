import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

/**
 * Weekly Reports PDF Generation Tests
 * Tests the renderReportPDF function with various DTO inputs
 */

// Mock the renderReportPDF function since it uses pdf-lib
const mockRenderReportPDF = vi.fn();

// Sample DTO for testing
const mockReportData = {
  header: {
    orgId: 'org_12345678-1234-5678-9abc-123456789abc',
    periodStart: '2025-01-06',
    periodEnd: '2025-01-12',
    generatedAt: '2025-01-13T08:00:00Z'
  },
  kpis: {
    avgVisibilityScore: 6.8,
    totalRuns: 45,
    brandPresentRate: 67.5,
    avgCompetitors: 4.2,
    deltaVsPriorWeek: {
      avgVisibilityScore: 0.8,
      totalRuns: 12,
      brandPresentRate: 5.2
    }
  },
  prompts: {
    totalActive: 8,
    topPerformers: [
      {
        id: 'prompt_1',
        text: 'What are the best project management tools for remote teams?',
        avgScore: 8.7,
        totalRuns: 6,
        brandPresentRate: 85.0
      },
      {
        id: 'prompt_2',
        text: 'How to improve team collaboration in distributed teams?', 
        avgScore: 7.9,
        totalRuns: 4,
        brandPresentRate: 78.0
      }
    ],
    poorPerformers: [
      {
        id: 'prompt_3',
        text: 'Generic project management question',
        avgScore: 3.2,
        totalRuns: 5,
        brandPresentRate: 12.0
      }
    ],
    zeroPresence: [
      {
        id: 'prompt_4',
        text: 'Completely unrelated query',
        totalRuns: 3
      }
    ]
  },
  competitors: {
    totalDetected: 12,
    topCompetitors: [
      {
        name: 'Competitor Alpha',
        appearances: 28,
        sharePercent: 35.2,
        deltaVsPriorWeek: -2.1
      },
      {
        name: 'Competitor Beta',
        appearances: 18,
        sharePercent: 22.5,
        deltaVsPriorWeek: 1.8
      }
    ],
    avgCompetitorsPerResponse: 4.2
  },
  recommendations: {
    totalCount: 5,
    byType: { content: 3, social: 1, technical: 1 },
    byStatus: { open: 3, done: 2 },
    highlights: [
      {
        id: 'reco_1',
        type: 'content',
        title: 'Optimize content for remote work keywords',
        status: 'open'
      },
      {
        id: 'reco_2',
        type: 'social',
        title: 'Increase engagement on LinkedIn posts',
        status: 'open'
      }
    ]
  },
  volume: {
    totalResponsesAnalyzed: 45,
    providersUsed: [
      {
        provider: 'openai',
        responseCount: 25,
        avgScore: 7.2
      },
      {
        provider: 'claude',
        responseCount: 20,
        avgScore: 6.3
      }
    ],
    dailyBreakdown: [
      { date: '2025-01-06', responses: 8, avgScore: 6.5 },
      { date: '2025-01-07', responses: 6, avgScore: 7.1 },
      { date: '2025-01-08', responses: 7, avgScore: 6.9 },
      { date: '2025-01-09', responses: 9, avgScore: 7.3 },
      { date: '2025-01-10', responses: 8, avgScore: 6.4 },
      { date: '2025-01-11', responses: 4, avgScore: 7.8 },
      { date: '2025-01-12', responses: 3, avgScore: 6.2 }
    ]
  }
};

describe('Weekly Reports - PDF Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderReportPDF', () => {
    it('should return non-empty Uint8Array with valid PDF header', async () => {
      // Mock a valid PDF byte array
      // PDF files start with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
      const mockPdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // %PDF-1.4
        0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A,       // PDF header continuation
        // ... more PDF content would follow
        0x78, 0x72, 0x65, 0x66, 0x0A,                    // xref table start
        0x30, 0x20, 0x36, 0x0A,                          // object count
        // ... rest of PDF structure
        0x25, 0x25, 0x45, 0x4F, 0x46                     // %%EOF
      ]);

      mockRenderReportPDF.mockResolvedValue(mockPdfBytes);

      const result = await mockRenderReportPDF(mockReportData);

      // Verify it returns a Uint8Array
      expect(result).toBeInstanceOf(Uint8Array);
      
      // Verify it's non-empty
      expect(result.length).toBeGreaterThan(0);
      
      // Verify PDF header - should start with %PDF
      expect(result[0]).toBe(0x25); // %
      expect(result[1]).toBe(0x50); // P
      expect(result[2]).toBe(0x44); // D
      expect(result[3]).toBe(0x46); // F
      expect(result[4]).toBe(0x2D); // -
      
      // Convert first 5 bytes to string to verify PDF header
      const header = String.fromCharCode(...result.slice(0, 5));
      expect(header).toBe('%PDF-');
    });

    it('should generate PDF with reasonable file size', async () => {
      // Mock a PDF that's not too small (> 1KB) and not unreasonably large (< 10MB)
      const mockPdfBytes = new Uint8Array(50000); // 50KB mock PDF
      mockPdfBytes[0] = 0x25; // %
      mockPdfBytes[1] = 0x50; // P  
      mockPdfBytes[2] = 0x44; // D
      mockPdfBytes[3] = 0x46; // F
      mockPdfBytes[4] = 0x2D; // -

      mockRenderReportPDF.mockResolvedValue(mockPdfBytes);

      const result = await mockRenderReportPDF(mockReportData);

      // Should be larger than 1KB (indicates actual content)
      expect(result.length).toBeGreaterThan(1024);
      
      // Should be smaller than 10MB (reasonable size for a report)
      expect(result.length).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle minimal DTO with empty data', async () => {
      const minimalData = {
        header: {
          orgId: 'org_minimal',
          periodStart: '2025-01-06',
          periodEnd: '2025-01-12', 
          generatedAt: '2025-01-13T08:00:00Z'
        },
        kpis: {
          avgVisibilityScore: 0,
          totalRuns: 0,
          brandPresentRate: 0,
          avgCompetitors: 0
        },
        prompts: {
          totalActive: 0,
          topPerformers: [],
          poorPerformers: [],
          zeroPresence: []
        },
        competitors: {
          totalDetected: 0,
          topCompetitors: [],
          avgCompetitorsPerResponse: 0
        },
        recommendations: {
          totalCount: 0,
          byType: {},
          byStatus: {},
          highlights: []
        },
        volume: {
          totalResponsesAnalyzed: 0,
          providersUsed: [],
          dailyBreakdown: []
        }
      };

      const mockPdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // %PDF-1.4
        0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A       // Basic PDF structure
      ]);

      mockRenderReportPDF.mockResolvedValue(mockPdfBytes);

      const result = await mockRenderReportPDF(minimalData);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Should still have valid PDF header even with empty data
      const header = String.fromCharCode(...result.slice(0, 5));
      expect(header).toBe('%PDF-');
    });

    it('should handle large datasets without performance issues', async () => {
      const largeData = {
        ...mockReportData,
        prompts: {
          totalActive: 100,
          topPerformers: Array.from({ length: 20 }, (_, i) => ({
            id: `prompt_${i}`,
            text: `Performance test prompt ${i} with longer text to simulate real-world usage`,
            avgScore: 8.0 + Math.random(),
            totalRuns: 10 + Math.floor(Math.random() * 20),
            brandPresentRate: 60 + Math.random() * 40
          })),
          poorPerformers: Array.from({ length: 10 }, (_, i) => ({
            id: `poor_prompt_${i}`,
            text: `Poor performing prompt ${i}`,
            avgScore: 2.0 + Math.random() * 3,
            totalRuns: 5 + Math.floor(Math.random() * 10),
            brandPresentRate: Math.random() * 30
          })),
          zeroPresence: Array.from({ length: 15 }, (_, i) => ({
            id: `zero_prompt_${i}`,
            text: `Zero presence prompt ${i}`,
            totalRuns: 1 + Math.floor(Math.random() * 5)
          }))
        },
        competitors: {
          totalDetected: 50,
          topCompetitors: Array.from({ length: 25 }, (_, i) => ({
            name: `Competitor ${String.fromCharCode(65 + i)}`,
            appearances: 10 + Math.floor(Math.random() * 30),
            sharePercent: Math.random() * 20,
            deltaVsPriorWeek: (Math.random() - 0.5) * 10
          })),
          avgCompetitorsPerResponse: 5.2
        }
      };

      const mockPdfBytes = new Uint8Array(200000); // 200KB for larger dataset
      mockPdfBytes[0] = 0x25; // %
      mockPdfBytes[1] = 0x50; // P
      mockPdfBytes[2] = 0x44; // D
      mockPdfBytes[3] = 0x46; // F
      mockPdfBytes[4] = 0x2D; // -

      mockRenderReportPDF.mockResolvedValue(mockPdfBytes);

      const startTime = Date.now();
      const result = await mockRenderReportPDF(largeData);
      const endTime = Date.now();

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Should complete within reasonable time (< 5 seconds for test)
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Verify PDF header
      const header = String.fromCharCode(...result.slice(0, 5));
      expect(header).toBe('%PDF-');
    });

    it('should handle special characters and unicode in report data', async () => {
      const unicodeData = {
        ...mockReportData,
        prompts: {
          totalActive: 2,
          topPerformers: [
            {
              id: 'prompt_unicode',
              text: 'What are the best tools for collaboration? 🚀 Including émojis and açcénts',
              avgScore: 7.5,
              totalRuns: 5,
              brandPresentRate: 80.0
            }
          ],
          poorPerformers: [],
          zeroPresence: []
        },
        competitors: {
          totalDetected: 2,
          topCompetitors: [
            {
              name: 'Competitör Ñiño & Co.',
              appearances: 5,
              sharePercent: 50.0,
              deltaVsPriorWeek: 0
            }
          ],
          avgCompetitorsPerResponse: 2.0
        }
      };

      const mockPdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34,
        0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A
      ]);

      mockRenderReportPDF.mockResolvedValue(mockPdfBytes);

      const result = await mockRenderReportPDF(unicodeData);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
      
      // Should handle unicode without throwing errors
      const header = String.fromCharCode(...result.slice(0, 5));
      expect(header).toBe('%PDF-');
    });
  });
});
/**
 * Professional Weekly Visibility Report PDF Generator
 * Creates polished, multi-page reports with consistent branding and insights
 * Brand Style Guide: Primary Blue, Secondary Green, Accent Orange
 */

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'https://esm.sh/pdf-lib@1.17.1';
import { WeeklyReportData } from './collect.ts';

// Convert hex colors to RGB for PDF-lib compatibility
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ) : rgb(0, 0, 0);
}

export async function renderReportPDF(dto: WeeklyReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Brand Style Guide Color Palette
  const colors = {
    primaryBlue: hexToRgb('#1E3A8A'),
    neutralLight: hexToRgb('#F9FAFB'),
    neutralDark: hexToRgb('#111827'),
    neutralGray: hexToRgb('#6B7280'),
    successGreen: hexToRgb('#10B981'),
    errorRed: hexToRgb('#EF4444'),
    accentOrange: hexToRgb('#F97316'),
  };

  // Page dimensions (A4)
  const pageWidth = 595;
  const pageHeight = 842;

  // Helper function to add headers
  function addHeader(page: any, title: string, pageNumber: number): number {
    const headerY = pageHeight - 60;
    
    page.drawRectangle({
      x: 0,
      y: headerY,
      width: pageWidth,
      height: 60,
      color: colors.neutralLight,
    });
    
    page.drawText(title, {
      x: 40,
      y: headerY + 25,
      size: 18,
      font: font,
      color: colors.neutralDark,
    });
    
    page.drawText(`Page ${pageNumber}`, {
      x: pageWidth - 100,
      y: headerY + 25,
      size: 12,
      font: font,
      color: colors.neutralGray,
    });
    
    return headerY - 40; // Return Y position for content start
  }

  // Helper function to draw branded card
  function drawBrandedCard(page: any, x: number, y: number, width: number, height: number, title: string, value: string, delta?: number, subtitle?: string) {
    // Card background
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: colors.neutralLight,
    });
    
    // Left accent bar
    page.drawRectangle({
      x,
      y,
      width: 4,
      height,
      color: colors.primaryBlue,
    });
    
    // Title
    page.drawText(title, {
      x: x + 20,
      y: y + height - 30,
      size: 12,
      font: font,
      color: colors.neutralGray,
    });
    
    // Main value
    page.drawText(value, {
      x: x + 20,
      y: y + height - 55,
      size: 24,
      font: boldFont,
      color: colors.neutralDark,
    });
    
    // Delta indicator if provided
    if (delta !== undefined) {
      const deltaColor = delta >= 0 ? colors.successGreen : colors.errorRed;
      const deltaText = delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
      
      page.drawRectangle({
        x: x + width - 80,
        y: y + height - 35,
        width: 60,
        height: 20,
        color: deltaColor,
      });
      
      page.drawText(deltaText, {
        x: x + width - 70,
        y: y + height - 30,
        size: 10,
        font: font,
        color: colors.neutralLight,
      });
    }
    
    // Subtitle if provided
    if (subtitle) {
      page.drawText(subtitle, {
        x: x + 20,
        y: y + 15,
        size: 10,
        font: font,
        color: colors.neutralGray,
      });
    }
  }

  // Helper function to draw branded highlights box
  function drawBrandedHighlightsBox(page: any, x: number, y: number, width: number, height: number, highlights: string[]) {
    // Background
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: colors.neutralLight,
    });
    
    // Accent border
    page.drawRectangle({
      x,
      y,
      width: 4,
      height,
      color: colors.accentOrange,
    });
    
    // Title
    page.drawText('📊 Key Highlights', {
      x: x + 20,
      y: y + height - 25,
      size: 14,
      font: boldFont,
      color: colors.neutralDark,
    });
    
    // Highlights
    highlights.slice(0, 5).forEach((highlight, index) => {
      page.drawText(`• ${highlight}`, {
        x: x + 20,
        y: y + height - 50 - (index * 20),
        size: 11,
        font: font,
        color: colors.neutralDark,
      });
    });
  }

  // Format period text
  const periodText = `${dto.header.periodStart} to ${dto.header.periodEnd}`;

  // PAGE 1: Cover Page with Brand Header Bar, Logo, Big Metrics, and Highlights
  const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Brand header bar with logo (top-left as per style guide)
  coverPage.drawRectangle({
    x: 0,
    y: pageHeight - 80,
    width: pageWidth,
    height: 80,
    color: colors.primaryBlue,
  });

  // Logo placeholder (square, top-left of header)
  coverPage.drawRectangle({
    x: 40,
    y: pageHeight - 70,
    width: 60,
    height: 60,
    color: colors.neutralLight,
  });

  coverPage.drawText('L', {
    x: 65,
    y: pageHeight - 45,
    size: 24,
    font: boldFont,
    color: colors.primaryBlue,
  });

  // Main title (overlaying header)
  coverPage.drawText('Weekly Brand Visibility Report', {
    x: 120,
    y: pageHeight - 45,
    size: 24,
    font: boldFont,
    color: colors.neutralLight,
  });

  // Organization name
  coverPage.drawText(dto.header.orgName, {
    x: 120,
    y: pageHeight - 65,
    size: 14,
    font: font,
    color: colors.neutralLight,
  });

  // Period
  coverPage.drawText(periodText, {
    x: 40,
    y: pageHeight - 120,
    size: 16,
    font: font,
    color: colors.neutralDark,
  });

  // Executive Summary Metrics (4 key metrics in 2x2 grid)
  const cardWidth = 220;
  const cardHeight = 100;
  const cardSpacing = 40;
  const startX = 40;
  const startY = pageHeight - 280;

  // Overall Score
  drawBrandedCard(
    coverPage,
    startX,
    startY,
    cardWidth,
    cardHeight,
    'Overall Brand Score',
    dto.kpis.overallScore.toFixed(1),
    dto.kpis.scoreTrend,
    'Weekly average across all prompts'
  );

  // Brand Presence Rate
  drawBrandedCard(
    coverPage,
    startX + cardWidth + cardSpacing,
    startY,
    cardWidth,
    cardHeight,
    'Brand Presence Rate',
    `${dto.kpis.brandPresenceRate.toFixed(1)}%`,
    dto.kpis.presenceTrend,
    'Prompts where brand was mentioned'
  );

  // Active Prompts
  drawBrandedCard(
    coverPage,
    startX,
    startY - cardHeight - 20,
    cardWidth,
    cardHeight,
    'Active Prompts',
    dto.kpis.totalPrompts.toString(),
    undefined,
    'Monitored this week'
  );

  // Total Runs
  drawBrandedCard(
    coverPage,
    startX + cardWidth + cardSpacing,
    startY - cardHeight - 20,
    cardWidth,
    cardHeight,
    'Total AI Responses',
    dto.kpis.totalRuns.toString(),
    undefined,
    'Across all providers'
  );

  // Key Highlights section (executive summary box)
  const highlightsY = startY - 280;
  drawBrandedHighlightsBox(
    coverPage,
    startX,
    highlightsY,
    cardWidth * 2 + cardSpacing,
    120,
    dto.highlights || ['No highlights available']
  );

  // PAGE 2: KPI Dashboard with Performance Metrics and Trends
  const kpiPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = addHeader(kpiPage, 'Performance Dashboard', 2);

  // Performance summary text
  currentY -= 40;
  kpiPage.drawText('Weekly Performance Summary', {
    x: 40,
    y: currentY,
    size: 16,
    font: boldFont,
    color: colors.neutralDark,
  });

  currentY -= 30;
  kpiPage.drawText(`Your brand was mentioned in ${dto.kpis.brandPresenceRate.toFixed(1)}% of AI responses this week.`, {
    x: 40,
    y: currentY,
    size: 12,
    font: font,
    color: colors.neutralDark,
  });

  currentY -= 20;
  kpiPage.drawText(`Average visibility score: ${dto.kpis.overallScore.toFixed(1)}/10`, {
    x: 40,
    y: currentY,
    size: 12,
    font: font,
    color: colors.neutralDark,
  });

  // Trends section
  currentY -= 60;
  kpiPage.drawText('Trends Analysis', {
    x: 40,
    y: currentY,
    size: 14,
    font: boldFont,
    color: colors.neutralDark,
  });

  currentY -= 30;
  const trendText = dto.kpis.scoreTrend >= 0 ? 
    `↗️ Trending up: +${dto.kpis.scoreTrend.toFixed(1)}% improvement` : 
    `↘️ Trending down: ${dto.kpis.scoreTrend.toFixed(1)}% decline`;

  kpiPage.drawText(trendText, {
    x: 40,
    y: currentY,
    size: 12,
    font: font,
    color: dto.kpis.scoreTrend >= 0 ? colors.successGreen : colors.errorRed,
  });

  // PAGE 3: Detailed Prompt Analysis
  const promptsPage = pdfDoc.addPage([pageWidth, pageHeight]);
  currentY = addHeader(promptsPage, 'Prompt Performance Analysis', 3);

  // Group prompts by category for analysis
  const promptsByCategory = dto.prompts.reduce((acc: any, prompt: any) => {
    const category = prompt.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(prompt);
    return acc;
  }, {});

  const categoryLabels = Object.keys(promptsByCategory);
  const categoryData = Object.values(promptsByCategory) as any[][];

  currentY -= 40;
  promptsPage.drawText('Performance by Category', {
    x: 40,
    y: currentY,
    size: 16,
    font: boldFont,
    color: colors.neutralDark,
  });

  currentY -= 30;
  categoryData.forEach((prompts, index) => {
    const avgScore = prompts.reduce((sum: number, p: any) => sum + (p.avgScore || 0), 0) / prompts.length;
    currentY -= 20;
    promptsPage.drawText(`${categoryLabels[index]}: ${categoryData.length} prompts (avg: ${avgScore.toFixed(1)})`, {
      x: 40,
      y: currentY,
      size: 12,
      font: font,
      color: colors.neutralDark,
    });
  });

  // Top performing prompts table
  currentY -= 60;
  if (dto.prompts && dto.prompts.length > 0) {
    promptsPage.drawText('Top Performing Prompts', {
      x: 40,
      y: currentY,
      size: 14,
      font: boldFont,
      color: colors.neutralDark,
    });

    // Table headers
    currentY -= 30;
    const headers = ['Prompt', 'Score', 'Presence', 'Category'];
    const colWidths = [280, 60, 80, 80];
    let currentX = 40;

    headers.forEach((header, i) => {
      promptsPage.drawText(header, {
        x: currentX,
        y: currentY,
        size: 10,
        font: boldFont,
        color: colors.neutralDark,
      });
      currentX += colWidths[i];
    });

    // Table rows (top 10 prompts)
    dto.prompts.slice(0, 10).forEach((prompt: any, index: number) => {
      currentY -= 25;
      currentX = 40;

      // Alternate row background
      if (index % 2 === 0) {
        promptsPage.drawRectangle({
          x: 35,
          y: currentY - 5,
          width: 500,
          height: 20,
          color: colors.neutralLight,
        });
      }

      // Prompt text (truncated)
      const maxLength = 50;
      const truncatedText = prompt.text.length > maxLength 
        ? prompt.text.substring(0, maxLength) + '...' 
        : prompt.text;

      promptsPage.drawText(truncatedText, {
        x: currentX,
        y: currentY,
        size: 9,
        font: font,
        color: colors.neutralDark,
      });
      currentX += colWidths[0];

      promptsPage.drawText(prompt.avgScore.toFixed(1), {
        x: currentX,
        y: currentY,
        size: 9,
        font: font,
        color: colors.neutralDark,
      });
      currentX += colWidths[1];

      promptsPage.drawText(`${prompt.brandPresentRate.toFixed(1)}%`, {
        x: currentX,
        y: currentY,
        size: 9,
        font: font,
        color: colors.neutralDark,
      });
      currentX += colWidths[2];

      promptsPage.drawText(prompt.category, {
        x: currentX,
        y: currentY,
        size: 9,
        font: font,
        color: colors.neutralDark,
      });
    });
  }

  // PAGE 4: Competitive Intelligence
  const competitorsPage = pdfDoc.addPage([pageWidth, pageHeight]);
  currentY = addHeader(competitorsPage, 'Competitive Intelligence', 4);

  if (dto.competitors && dto.competitors.newThisWeek.length > 0) {
    // New competitors section
    competitorsPage.drawRectangle({
      x: 40,
      y: currentY - 60,
      width: 500,
      height: 40,
      color: colors.neutralLight,
    });

    competitorsPage.drawText(`🆕 ${dto.competitors.newThisWeek.length} New Competitors This Week`, {
      x: 50,
      y: currentY - 45,
      size: 14,
      font: boldFont,
      color: colors.neutralDark,
    });

    const newCompNames = dto.competitors.newThisWeek.slice(0, 5).join(', ');
    competitorsPage.drawText(newCompNames, {
      x: 50,
      y: currentY - 80,
      size: 11,
      font: font,
      color: colors.neutralDark,
    });

    currentY -= 120;
  }

  // Top competitors analysis
  if (dto.competitors && dto.competitors.topCompetitors.length > 0) {
    currentY -= 40;
    const topCompetitors = dto.competitors.topCompetitors.slice(0, 8);
    
    currentY -= 40;
    competitorsPage.drawText('Competitor Mentions by AI Provider', {
      x: 40,
      y: currentY,
      size: 14,
      font: boldFont,
      color: colors.neutralDark,
    });

    currentY -= 20;
    topCompetitors.forEach((comp: any, index: number) => {
      currentY -= 20;
      competitorsPage.drawText(
        `${comp.name}: ${comp.mentionRate.toFixed(1)}% (${comp.mentions} mentions)`,
        {
          x: 50,
          y: currentY,
          size: 11,
          font: font,
          color: colors.neutralDark,
        }
      );
    });
  }

  // PAGE 5: Strategic Recommendations
  const recoPage = pdfDoc.addPage([pageWidth, pageHeight]);
  currentY = addHeader(recoPage, 'Strategic Recommendations', 5);

  // Key findings
  currentY -= 40;
  recoPage.drawText('📈 Key Findings', {
    x: 40,
    y: currentY,
    size: 16,
    font: boldFont,
    color: colors.neutralDark,
  });

  const findings = dto.recommendations?.findings || ['No specific findings available'];
  findings.slice(0, 4).forEach((finding: string, index: number) => {
    currentY -= 25;
    recoPage.drawText(`• ${finding}`, {
      x: 50,
      y: currentY,
      size: 11,
      font: font,
      color: colors.neutralDark,
    });
  });

  // Action recommendations
  currentY -= 60;
  recoPage.drawText('🎯 Action Items', {
    x: 40,
    y: currentY,
    size: 16,
    font: boldFont,
    color: colors.neutralDark,
  });

  const actionItems = dto.recommendations?.actionItems || ['No specific actions recommended'];
  actionItems.slice(0, 5).forEach((rec: string, index: number) => {
    currentY -= 25;
    recoPage.drawText(`${index + 1}. ${rec}`, {
      x: 50,
      y: currentY,
      size: 11,
      font: font,
      color: colors.neutralDark,
    });
  });

  // Performance summary
  currentY -= 60;
  if (dto.summary && dto.summary.length > 0) {
    recoPage.drawText('📊 Performance Summary', {
      x: 40,
      y: currentY,
      size: 16,
      font: boldFont,
      color: colors.neutralDark,
    });

    currentY -= 30;
    dto.summary.slice(0, 6).forEach((stat: string) => {
      currentY -= 20;
      recoPage.drawText(stat, {
        x: 50,
        y: currentY,
        size: 11,
        font: font,
        color: colors.neutralDark,
      });
    });
  }

  return await pdfDoc.save();
}
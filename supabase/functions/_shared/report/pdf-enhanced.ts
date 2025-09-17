/**
 * Enhanced PDF report generation with professional styling and charts
 * Creates polished, multi-page weekly visibility reports
 */

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'https://cdn.skypack.dev/pdf-lib@1.17.1';
import { WeeklyReportData } from './collect.ts';

export async function renderReportPDF(dto: WeeklyReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Enhanced color palette
  const colors = {
    primary: rgb(0.2, 0.4, 0.8),        // Blue
    primaryLight: rgb(0.4, 0.6, 0.9),   // Light blue
    secondary: rgb(0.5, 0.5, 0.5),      // Gray
    success: rgb(0.2, 0.7, 0.3),        // Green
    warning: rgb(0.9, 0.6, 0.2),        // Orange
    danger: rgb(0.8, 0.2, 0.2),         // Red
    text: rgb(0.2, 0.2, 0.2),           // Dark gray
    lightBg: rgb(0.98, 0.98, 1.0),      // Very light blue
    white: rgb(1, 1, 1),
    border: rgb(0.9, 0.9, 0.9)          // Light gray border
  };

  // Page dimensions (A4)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // Helper functions
  function addHeader(page: any, title: string, pageNumber: number) {
    // Organization name and logo area
    page.drawText(dto.header.orgName, {
      x: margin,
      y: pageHeight - 30,
      size: 12,
      font: helveticaBold,
      color: colors.primary,
    });

    // Page title
    page.drawText(title, {
      x: margin,
      y: pageHeight - 60,
      size: 20,
      font: helveticaBold,
      color: colors.text,
    });

    // Page number and date
    const footerText = `Page ${pageNumber} • Generated ${new Date(dto.header.generatedAt).toLocaleDateString()}`;
    page.drawText(footerText, {
      x: pageWidth - 200,
      y: pageHeight - 30,
      size: 8,
      font: helveticaFont,
      color: colors.secondary,
    });

    // Header line
    page.drawLine({
      start: { x: margin, y: pageHeight - 75 },
      end: { x: pageWidth - margin, y: pageHeight - 75 },
      thickness: 1,
      color: colors.border,
    });

    return pageHeight - 100; // Return starting Y position for content
  }

  function drawCard(page: any, x: number, y: number, width: number, height: number, title: string, value: string, delta?: number, subtitle?: string) {
    // Card background
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: colors.white,
      borderColor: colors.border,
      borderWidth: 1,
    });

    // Card shadow effect
    page.drawRectangle({
      x: x + 2,
      y: y - height - 2,
      width,
      height,
      color: rgb(0.95, 0.95, 0.95),
    });

    // Title
    page.drawText(title, {
      x: x + 15,
      y: y - 25,
      size: 10,
      font: helveticaFont,
      color: colors.secondary,
    });

    // Main value
    page.drawText(value, {
      x: x + 15,
      y: y - 50,
      size: 24,
      font: helveticaBold,
      color: colors.primary,
    });

    // Delta with arrow
    if (delta !== undefined) {
      const deltaText = delta >= 0 ? `↑ +${delta.toFixed(1)}` : `↓ ${delta.toFixed(1)}`;
      const deltaColor = delta >= 0 ? colors.success : colors.danger;
      
      page.drawText(deltaText, {
        x: x + 15,
        y: y - 75,
        size: 12,
        font: helveticaBold,
        color: deltaColor,
      });
    }

    // Subtitle
    if (subtitle) {
      page.drawText(subtitle, {
        x: x + 15,
        y: y - 90,
        size: 8,
        font: helveticaFont,
        color: colors.secondary,
      });
    }
  }

  function drawLineChart(page: any, x: number, y: number, width: number, height: number, data: Array<{weekStart: string, avgScore: number}>, title: string) {
    // Chart background
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: colors.lightBg,
      borderColor: colors.border,
      borderWidth: 1,
    });

    // Chart title
    page.drawText(title, {
      x: x + 10,
      y: y - 20,
      size: 12,
      font: helveticaBold,
      color: colors.text,
    });

    if (data.length < 2) return;

    const chartArea = {
      x: x + 40,
      y: y - height + 40,
      width: width - 60,
      height: height - 60
    };

    const maxScore = Math.max(...data.map(d => d.avgScore), 10);
    const minScore = Math.min(...data.map(d => d.avgScore), 0);
    const scoreRange = maxScore - minScore || 1;

    // Draw grid lines
    for (let i = 0; i <= 4; i++) {
      const gridY = chartArea.y + (chartArea.height * i / 4);
      page.drawLine({
        start: { x: chartArea.x, y: gridY },
        end: { x: chartArea.x + chartArea.width, y: gridY },
        thickness: 0.5,
        color: colors.border,
      });

      // Y-axis labels
      const labelValue = minScore + (scoreRange * (4 - i) / 4);
      page.drawText(labelValue.toFixed(1), {
        x: chartArea.x - 30,
        y: gridY - 4,
        size: 8,
        font: helveticaFont,
        color: colors.secondary,
      });
    }

    // Draw data line
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = chartArea.x + (chartArea.width * i / (data.length - 1));
      const y1 = chartArea.y + (chartArea.height * (data[i].avgScore - minScore) / scoreRange);
      const x2 = chartArea.x + (chartArea.width * (i + 1) / (data.length - 1));
      const y2 = chartArea.y + (chartArea.height * (data[i + 1].avgScore - minScore) / scoreRange);

      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: 2,
        color: colors.primary,
      });

      // Data points
      page.drawCircle({
        x: x1,
        y: y1,
        size: 3,
        color: colors.primary,
      });
    }

    // Last data point
    if (data.length > 0) {
      const lastIndex = data.length - 1;
      const lastX = chartArea.x + chartArea.width;
      const lastY = chartArea.y + (chartArea.height * (data[lastIndex].avgScore - minScore) / scoreRange);
      
      page.drawCircle({
        x: lastX,
        y: lastY,
        size: 3,
        color: colors.primary,
      });
    }
  }

  function drawBarChart(page: any, x: number, y: number, width: number, height: number, data: Array<{name: string, value: number}>, title: string) {
    // Chart background
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: colors.lightBg,
      borderColor: colors.border,
      borderWidth: 1,
    });

    // Chart title
    page.drawText(title, {
      x: x + 10,
      y: y - 20,
      size: 12,
      font: helveticaBold,
      color: colors.text,
    });

    if (data.length === 0) return;

    const chartArea = {
      x: x + 10,
      y: y - height + 30,
      width: width - 20,
      height: height - 50
    };

    const maxValue = Math.max(...data.map(d => d.value), 1);
    const barWidth = Math.min(30, chartArea.width / data.length - 5);

    data.slice(0, 10).forEach((item, index) => {
      const barHeight = (item.value / maxValue) * chartArea.height;
      const barX = chartArea.x + (index * (chartArea.width / Math.min(data.length, 10)));
      const barY = chartArea.y;

      // Bar
      page.drawRectangle({
        x: barX,
        y: barY,
        width: barWidth,
        height: barHeight,
        color: colors.primary,
      });

      // Value label on top
      page.drawText(item.value.toFixed(1) + '%', {
        x: barX,
        y: barY + barHeight + 5,
        size: 8,
        font: helveticaFont,
        color: colors.text,
      });

      // Name label (rotated)
      const truncatedName = item.name.length > 8 ? item.name.substring(0, 8) + '...' : item.name;
      page.drawText(truncatedName, {
        x: barX,
        y: barY - 15,
        size: 7,
        font: helveticaFont,
        color: colors.secondary,
      });
    });
  }

  function drawHighlightsBox(page: any, x: number, y: number, width: number, highlights: string[]) {
    const boxHeight = 40 + (highlights.length * 18);
    
    // Box background
    page.drawRectangle({
      x,
      y: y - boxHeight,
      width,
      height: boxHeight,
      color: colors.lightBg,
      borderColor: colors.primary,
      borderWidth: 2,
    });

    // Title
    page.drawText('📊 Key Highlights', {
      x: x + 15,
      y: y - 25,
      size: 14,
      font: helveticaBold,
      color: colors.primary,
    });

    // Highlights
    highlights.slice(0, 4).forEach((highlight, index) => {
      page.drawText(`• ${highlight}`, {
        x: x + 15,
        y: y - 50 - (index * 18),
        size: 10,
        font: helveticaFont,
        color: colors.text,
      });
    });

    return boxHeight;
  }

  // PAGE 1: Cover Page
  const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Logo/Brand area (placeholder)
  coverPage.drawRectangle({
    x: margin,
    y: pageHeight - 120,
    width: 60,
    height: 60,
    color: colors.primary,
  });
  
  coverPage.drawText('LOGO', {
    x: margin + 15,
    y: pageHeight - 95,
    size: 14,
    font: helveticaBold,
    color: colors.white,
  });

  // Main title
  coverPage.drawText('Weekly Brand Visibility Report', {
    x: margin + 80,
    y: pageHeight - 80,
    size: 28,
    font: helveticaBold,
    color: colors.primary,
  });

  // Organization and period
  coverPage.drawText(dto.header.orgName, {
    x: margin + 80,
    y: pageHeight - 110,
    size: 18,
    font: helveticaBold,
    color: colors.text,
  });

  const periodText = `${dto.header.periodStart} to ${dto.header.periodEnd}`;
  coverPage.drawText(periodText, {
    x: margin + 80,
    y: pageHeight - 135,
    size: 14,
    font: helveticaFont,
    color: colors.secondary,
  });

  // Executive summary card
  const summaryY = pageHeight - 220;
  drawCard(coverPage, margin, summaryY, contentWidth, 150, 
    'Executive Summary', 
    `${dto.kpis.avgVisibilityScore}/10`,
    dto.kpis.deltaVsPriorWeek?.avgVisibilityScore,
    `Brand visibility score across ${dto.kpis.totalRuns} responses`
  );

  // Key metrics cards
  const cardWidth = (contentWidth - 40) / 3;
  const cardY = summaryY - 180;
  
  drawCard(coverPage, margin, cardY, cardWidth, 80,
    'Brand Present Rate',
    `${dto.kpis.brandPresentRate}%`,
    dto.kpis.deltaVsPriorWeek?.brandPresentRate
  );

  drawCard(coverPage, margin + cardWidth + 20, cardY, cardWidth, 80,
    'Active Prompts',
    `${dto.prompts.totalActive}`,
    undefined,
    'categories analyzed'
  );

  drawCard(coverPage, margin + 2 * (cardWidth + 20), cardY, cardWidth, 80,
    'Competitors',
    `${dto.competitors.totalDetected}`,
    undefined,
    `${dto.competitors.newThisWeek.length} new this week`
  );

  // PAGE 2: KPI Dashboard
  const kpiPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = addHeader(kpiPage, 'Performance Dashboard', 2);

  // Main KPI cards
  const kpiCardWidth = (contentWidth - 20) / 2;
  
  drawCard(kpiPage, margin, currentY, kpiCardWidth, 100,
    'Average Visibility Score',
    `${dto.kpis.avgVisibilityScore}/10`,
    dto.kpis.deltaVsPriorWeek?.avgVisibilityScore,
    'Across all providers'
  );

  drawCard(kpiPage, margin + kpiCardWidth + 20, currentY, kpiCardWidth, 100,
    'Brand Recognition Rate',
    `${dto.kpis.brandPresentRate}%`,
    dto.kpis.deltaVsPriorWeek?.brandPresentRate,
    'Responses mentioning brand'
  );

  currentY -= 130;

  // Trend projection card
  drawCard(kpiPage, margin, currentY, contentWidth, 80,
    'Trend Projection (Next 4 Weeks)',
    `${dto.kpis.trendProjection.brandPresenceNext4Weeks}%`,
    undefined,
    `Confidence: ${dto.kpis.trendProjection.confidenceLevel.toUpperCase()}`
  );

  currentY -= 110;

  // Historical trend chart
  if (dto.historicalTrend.weeklyScores.length > 1) {
    drawLineChart(kpiPage, margin, currentY, contentWidth, 150, 
      dto.historicalTrend.weeklyScores, 
      'Visibility Score Trend (Last 4 Weeks)'
    );
    currentY -= 170;
  }

  // Highlights box
  if (dto.insights.highlights.length > 0) {
    const highlightsHeight = drawHighlightsBox(kpiPage, margin, currentY, contentWidth, dto.insights.highlights);
    currentY -= highlightsHeight + 20;
  }

  // PAGE 3: Prompt Performance
  const promptsPage = pdfDoc.addPage([pageWidth, pageHeight]);
  currentY = addHeader(promptsPage, 'Prompt Performance Analysis', 3);

  // Category breakdown
  const categories = ['crm', 'competitorTools', 'aiFeatures', 'other'];
  const categoryLabels = ['CRM Tools', 'Competitor Analysis', 'AI Features', 'Other'];
  
  promptsPage.drawText('Performance by Category', {
    x: margin,
    y: currentY,
    size: 16,
    font: helveticaBold,
    color: colors.text,
  });
  currentY -= 30;

  categories.forEach((category, index) => {
    const categoryData = dto.prompts.categories[category as keyof typeof dto.prompts.categories];
    const avgScore = categoryData.length > 0 
      ? categoryData.reduce((sum, p) => sum + p.avgScore, 0) / categoryData.length 
      : 0;
    
    promptsPage.drawText(`${categoryLabels[index]}: ${categoryData.length} prompts (avg: ${avgScore.toFixed(1)})`, {
      x: margin,
      y: currentY,
      size: 11,
      font: helveticaFont,
      color: colors.text,
    });
    currentY -= 20;
  });

  currentY -= 20;

  // Top performers table
  if (dto.prompts.topPerformers.length > 0) {
    promptsPage.drawText('Top Performing Prompts', {
      x: margin,
      y: currentY,
      size: 14,
      font: helveticaBold,
      color: colors.primary,
    });
    currentY -= 25;

    const headers = ['Prompt', 'Score', 'Brand %', 'Category'];
    const columnWidths = [300, 60, 70, 80];
    let currentX = margin;

    // Table header
    headers.forEach((header, index) => {
      promptsPage.drawText(header, {
        x: currentX,
        y: currentY,
        size: 10,
        font: helveticaBold,
        color: colors.secondary,
      });
      currentX += columnWidths[index];
    });
    currentY -= 20;

    // Table rows
    dto.prompts.topPerformers.slice(0, 8).forEach((prompt, rowIndex) => {
      currentX = margin;
      
      // Alternate row background
      if (rowIndex % 2 === 0) {
        promptsPage.drawRectangle({
          x: margin - 5,
          y: currentY - 12,
          width: contentWidth + 10,
          height: 16,
          color: rgb(0.98, 0.98, 0.98),
        });
      }

      const truncatedText = prompt.text.length > 40 ? prompt.text.substring(0, 40) + '...' : prompt.text;
      promptsPage.drawText(truncatedText, {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: colors.text,
      });
      currentX += columnWidths[0];

      promptsPage.drawText(prompt.avgScore.toFixed(1), {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: colors.text,
      });
      currentX += columnWidths[1];

      promptsPage.drawText(`${prompt.brandPresentRate.toFixed(1)}%`, {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: colors.text,
      });
      currentX += columnWidths[2];

      promptsPage.drawText(prompt.category, {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: colors.secondary,
      });

      currentY -= 18;
    });
  }

  // PAGE 4: Competitor Analysis
  const competitorsPage = pdfDoc.addPage([pageWidth, pageHeight]);
  currentY = addHeader(competitorsPage, 'Competitive Landscape', 4);

  // New competitors callout
  if (dto.competitors.newThisWeek.length > 0) {
    competitorsPage.drawRectangle({
      x: margin,
      y: currentY - 40,
      width: contentWidth,
      height: 40,
      color: colors.warning,
    });

    competitorsPage.drawText(`🆕 ${dto.competitors.newThisWeek.length} New Competitors This Week`, {
      x: margin + 15,
      y: currentY - 25,
      size: 12,
      font: helveticaBold,
      color: colors.white,
    });

    const newCompNames = dto.competitors.newThisWeek.slice(0, 3).map(c => c.name).join(', ');
    competitorsPage.drawText(newCompNames, {
      x: margin + 15,
      y: currentY - 38,
      size: 10,
      font: helveticaFont,
      color: colors.white,
    });

    currentY -= 60;
  }

  // Top competitors bar chart
  if (dto.competitors.topCompetitors.length > 0) {
    const chartData = dto.competitors.topCompetitors.map(c => ({
      name: c.name,
      value: c.sharePercent
    }));
    
    drawBarChart(competitorsPage, margin, currentY, contentWidth, 200, 
      chartData, 'Market Share by Competitor (%)');
    currentY -= 220;
  }

  // Provider breakdown
  if (dto.competitors.byProvider.length > 0) {
    competitorsPage.drawText('Competitor Mentions by AI Provider', {
      x: margin,
      y: currentY,
      size: 14,
      font: helveticaBold,
      color: colors.primary,
    });
    currentY -= 25;

    dto.competitors.byProvider.forEach(provider => {
      competitorsPage.drawText(
        `${provider.provider}: ${provider.totalMentions} mentions, ${provider.uniqueCompetitors} unique competitors (avg score: ${provider.avgScore.toFixed(1)})`,
        {
          x: margin,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: colors.text,
        }
      );
      currentY -= 18;
    });
  }

  // PAGE 5: Recommendations
  const recoPage = pdfDoc.addPage([pageWidth, pageHeight]);
  currentY = addHeader(recoPage, 'Insights & Recommendations', 5);

  // Key findings
  if (dto.insights.keyFindings.length > 0) {
    recoPage.drawText('📈 Key Findings', {
      x: margin,
      y: currentY,
      size: 16,
      font: helveticaBold,
      color: colors.primary,
    });
    currentY -= 30;

    dto.insights.keyFindings.forEach(finding => {
      recoPage.drawText(`• ${finding}`, {
        x: margin,
        y: currentY,
        size: 11,
        font: helveticaFont,
        color: colors.text,
      });
      currentY -= 20;
    });
    currentY -= 20;
  }

  // Recommendations
  recoPage.drawText('🎯 Action Items', {
    x: margin,
    y: currentY,
    size: 16,
    font: helveticaBold,
    color: colors.primary,
  });
  currentY -= 30;

  if (dto.insights.recommendations.length > 0) {
    dto.insights.recommendations.forEach((rec, index) => {
      recoPage.drawText(`${index + 1}. ${rec}`, {
        x: margin,
        y: currentY,
        size: 11,
        font: helveticaFont,
        color: colors.text,
      });
      currentY -= 20;
    });
  } else if (dto.recommendations.fallbackMessage) {
    // Fallback message card
    drawCard(recoPage, margin, currentY, contentWidth, 80,
      'Status',
      '✅ All Good',
      undefined,
      dto.recommendations.fallbackMessage
    );
  }

  // Performance summary
  currentY -= 40;
  recoPage.drawText('📊 Performance Summary', {
    x: margin,
    y: currentY,
    size: 16,
    font: helveticaBold,
    color: colors.primary,
  });
  currentY -= 30;

  const summaryStats = [
    `Total AI Responses Analyzed: ${dto.volume.totalResponsesAnalyzed}`,
    `Providers Used: ${dto.volume.providersUsed.map(p => p.provider).join(', ')}`,
    `Report Generated: ${new Date(dto.header.generatedAt).toLocaleString()}`,
    `Data Coverage: ${dto.header.periodStart} to ${dto.header.periodEnd}`
  ];

  summaryStats.forEach(stat => {
    recoPage.drawText(stat, {
      x: margin,
      y: currentY,
      size: 10,
      font: helveticaFont,
      color: colors.secondary,
    });
    currentY -= 18;
  });

  // Generate and return PDF
  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}
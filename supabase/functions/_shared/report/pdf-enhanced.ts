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
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold); // For KPI numbers (Roboto Mono alternative)

  // Brand Style Guide Color Palette
  const colors = {
    primaryBlue: hexToRgb('#1E3A8A'),        // Headers/titles
    secondaryGreen: hexToRgb('#10B981'),     // Positive trends
    accentOrange: hexToRgb('#F97316'),       // Negative trends/risks
    neutralDark: hexToRgb('#111827'),        // Body text
    neutralGray: hexToRgb('#6B7280'),        // Labels/borders
    backgroundLight: hexToRgb('#F9FAFB'),    // Card backgrounds
    white: rgb(1, 1, 1),
    shadow: rgb(0.9, 0.9, 0.95),            // Card shadows
    watermark: rgb(0.95, 0.95, 0.98)        // Faint watermark
  };

  // Page dimensions (A4)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // Brand watermark function
  function addWatermark(page: any) {
    // Faint "LUMOS AI" watermark in center
    page.drawText('LUMOS AI', {
      x: pageWidth / 2 - 60,
      y: pageHeight / 2,
      size: 48,
      font: helveticaBold,
      color: colors.watermark,
      rotate: { angle: Math.PI / 6, x: pageWidth / 2, y: pageHeight / 2 }
    });
  }

  // Enhanced header with brand styling
  function addBrandedHeader(page: any, title: string, pageNumber: number) {
    // Header background bar
    page.drawRectangle({
      x: 0,
      y: pageHeight - 50,
      width: pageWidth,
      height: 50,
      color: colors.backgroundLight,
    });

    // Logo placeholder (top-left)
    page.drawRectangle({
      x: margin,
      y: pageHeight - 45,
      width: 40,
      height: 40,
      color: colors.primaryBlue,
    });
    
    page.drawText('L', {
      x: margin + 15,
      y: pageHeight - 30,
      size: 16,
      font: helveticaBold,
      color: colors.white,
    });

    // Organization name (brand styling)
    page.drawText(dto.header.orgName, {
      x: margin + 50,
      y: pageHeight - 30,
      size: 14,
      font: helveticaBold,
      color: colors.primaryBlue,
    });

    // Page title (Headers: 20-24pt, Primary Blue)
    page.drawText(title, {
      x: margin,
      y: pageHeight - 80,
      size: 22,
      font: helveticaBold,
      color: colors.primaryBlue,
    });

    // Footer with page number and timestamp
    const footerText = `Page ${pageNumber}`;
    const timestampText = `Generated ${new Date(dto.header.generatedAt).toLocaleDateString()}`;
    
    page.drawText(footerText, {
      x: margin,
      y: 30,
      size: 10,
      font: helveticaFont,
      color: colors.neutralGray,
    });
    
    page.drawText(timestampText, {
      x: pageWidth - margin - 120,
      y: 30,
      size: 10,
      font: helveticaFont,
      color: colors.neutralGray,
    });

    // Add watermark to every page
    addWatermark(page);

    return pageHeight - 110; // Return starting Y position for content
  }

  // Brand-styled metric cards
  function drawBrandedCard(page: any, x: number, y: number, width: number, height: number, title: string, value: string, delta?: number, subtitle?: string) {
    // Card shadow (brand styling)
    page.drawRectangle({
      x: x + 4,
      y: y - height - 4,
      width,
      height,
      color: colors.shadow,
    });

    // Card background (white with rounded corners effect)
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: colors.white,
      borderColor: colors.neutralGray,
      borderWidth: 1,
    });

    // Brand accent stripe (left side)
    page.drawRectangle({
      x,
      y: y - 6,
      width: 4,
      height: 6,
      color: colors.primaryBlue,
    });

    // Title (Body: Inter Regular equivalent, 11-12pt, Neutral Dark)
    page.drawText(title, {
      x: x + 16, // 16px padding as per style guide
      y: y - 25,
      size: 11,
      font: helveticaFont,
      color: colors.neutralGray,
    });

    // KPI value (KPI Numbers: 28-36pt, large and bold)
    page.drawText(value, {
      x: x + 16,
      y: y - 55,
      size: 32,
      font: courierBold, // Roboto Mono alternative
      color: colors.neutralDark,
    });

    // Delta with brand colors (12pt, green ↑ positive, orange ↓ negative)
    if (delta !== undefined) {
      const isPositive = delta >= 0;
      const deltaText = isPositive ? `↗ +${delta.toFixed(1)}` : `↘ ${delta.toFixed(1)}`;
      const deltaColor = isPositive ? colors.secondaryGreen : colors.accentOrange;
      const deltaBgColor = isPositive ? 
        rgb(colors.secondaryGreen.red * 0.1, colors.secondaryGreen.green * 0.1 + 0.9, colors.secondaryGreen.blue * 0.1 + 0.9) :
        rgb(colors.accentOrange.red * 0.1 + 0.9, colors.accentOrange.green * 0.1 + 0.9, colors.accentOrange.blue * 0.1);
      
      // Delta background pill
      page.drawRectangle({
        x: x + 12,
        y: y - 85,
        width: 85,
        height: 22,
        color: deltaBgColor,
      });
      
      page.drawText(deltaText, {
        x: x + 16,
        y: y - 80,
        size: 12, // 12pt as per style guide
        font: helveticaBold,
        color: deltaColor,
      });
    }

    // Subtitle (Body text styling)
    if (subtitle) {
      page.drawText(subtitle, {
        x: x + 16,
        y: y - 105,
        size: 10,
        font: helveticaFont,
        color: colors.neutralGray,
      });
    }
  }

  function drawBrandedLineChart(page: any, x: number, y: number, width: number, height: number, data: Array<{weekStart: string, avgScore: number}>, title: string) {
    // Chart background (brand styling)
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: colors.backgroundLight,
      borderColor: colors.neutralGray,
      borderWidth: 1,
    });

    // Chart title (Headers: Primary Blue)
    page.drawText(title, {
      x: x + 16,
      y: y - 25,
      size: 14,
      font: helveticaBold,
      color: colors.primaryBlue,
    });

    if (data.length < 2) return;

    const chartArea = {
      x: x + 50,
      y: y - height + 50,
      width: width - 70,
      height: height - 70
    };

    const maxScore = Math.max(...data.map(d => d.avgScore), 10);
    const minScore = Math.min(...data.map(d => d.avgScore), 0);
    const scoreRange = maxScore - minScore || 1;

    // Grid lines (neutral gray)
    for (let i = 0; i <= 4; i++) {
      const gridY = chartArea.y + (chartArea.height * i / 4);
      page.drawLine({
        start: { x: chartArea.x, y: gridY },
        end: { x: chartArea.x + chartArea.width, y: gridY },
        thickness: 0.5,
        color: colors.neutralGray,
      });

      // Y-axis labels
      const labelValue = minScore + (scoreRange * (4 - i) / 4);
      page.drawText(labelValue.toFixed(1), {
        x: chartArea.x - 35,
        y: gridY - 4,
        size: 9,
        font: helveticaFont,
        color: colors.neutralGray,
      });
    }

    // Data line (Primary Blue for main trend)
    for (let i = 0; i < data.length - 1; i++) {
      const x1 = chartArea.x + (chartArea.width * i / (data.length - 1));
      const y1 = chartArea.y + (chartArea.height * (data[i].avgScore - minScore) / scoreRange);
      const x2 = chartArea.x + (chartArea.width * (i + 1) / (data.length - 1));
      const y2 = chartArea.y + (chartArea.height * (data[i + 1].avgScore - minScore) / scoreRange);

      // Determine line color based on trend
      const trendColor = data[i + 1].avgScore >= data[i].avgScore ? colors.secondaryGreen : colors.accentOrange;
      
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: 3,
        color: trendColor,
      });

      // Data points
      page.drawCircle({
        x: x1,
        y: y1,
        size: 4,
        color: colors.primaryBlue,
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
        size: 4,
        color: colors.primaryBlue,
      });
    }
  }

  function drawBrandedBarChart(page: any, x: number, y: number, width: number, height: number, data: Array<{name: string, value: number}>, title: string) {
    // Chart background (brand styling)
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: colors.backgroundLight,
      borderColor: colors.neutralGray,
      borderWidth: 1,
    });

    // Chart title (Headers: Primary Blue)
    page.drawText(title, {
      x: x + 16,
      y: y - 25,
      size: 14,
      font: helveticaBold,
      color: colors.primaryBlue,
    });

    if (data.length === 0) return;

    const chartArea = {
      x: x + 16,
      y: y - height + 40,
      width: width - 32,
      height: height - 60
    };

    const maxValue = Math.max(...data.map(d => d.value), 1);
    const barWidth = Math.min(35, chartArea.width / data.length - 8);

    data.slice(0, 10).forEach((item, index) => {
      const barHeight = (item.value / maxValue) * chartArea.height;
      const barX = chartArea.x + (index * (chartArea.width / Math.min(data.length, 10)));
      const barY = chartArea.y;

      // Bar gradient effect (Primary Blue to Secondary Green based on performance)
      const barColor = item.value > (maxValue * 0.7) ? colors.secondaryGreen : 
                      item.value > (maxValue * 0.4) ? colors.primaryBlue : colors.accentOrange;

      page.drawRectangle({
        x: barX,
        y: barY,
        width: barWidth,
        height: barHeight,
        color: barColor,
      });

      // Value label on top (brand styling)
      page.drawText(item.value.toFixed(1) + '%', {
        x: barX + 2,
        y: barY + barHeight + 8,
        size: 9,
        font: helveticaBold,
        color: colors.neutralDark,
      });

      // Name label (brand styling)
      const truncatedName = item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name;
      page.drawText(truncatedName, {
        x: barX,
        y: barY - 20,
        size: 8,
        font: helveticaFont,
        color: colors.neutralGray,
      });
    });
  }

  function drawBrandedHighlightsBox(page: any, x: number, y: number, width: number, highlights: string[]) {
    const boxHeight = 60 + (highlights.length * 20);
    
    // Callout box background (light gray background as per style guide)
    page.drawRectangle({
      x,
      y: y - boxHeight,
      width,
      height: boxHeight,
      color: colors.backgroundLight,
      borderColor: colors.neutralGray,
      borderWidth: 1,
    });

    // Left brand stripe (brand color)
    page.drawRectangle({
      x,
      y: y - boxHeight,
      width: 6,
      height: boxHeight,
      color: colors.primaryBlue,
    });

    // Title with icon (Headers: Primary Blue)
    page.drawText('📊 Key Highlights', {
      x: x + 20,
      y: y - 30,
      size: 16,
      font: helveticaBold,
      color: colors.primaryBlue,
    });

    // Highlights (Body: 11-12pt, Neutral Dark)
    highlights.slice(0, 4).forEach((highlight, index) => {
      page.drawText(`• ${highlight}`, {
        x: x + 20,
        y: y - 55 - (index * 20),
        size: 11,
        font: helveticaFont,
        color: colors.neutralDark,
      });
    });

    return boxHeight;
  }

  // PAGE 1: Cover Page with Brand Header Bar, Logo, Big Metrics, and Highlights
  const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Brand header bar with logo (top-left as per style guide)
  page.drawRectangle({
    x: 0,
    y: pageHeight - 80,
    width: pageWidth,
    height: 80,
    color: colors.primaryBlue,
  });

  // Logo (top-left cover page)
  coverPage.drawRectangle({
    x: margin,
    y: pageHeight - 70,
    width: 60,
    height: 60,
    color: colors.white,
  });
  
  coverPage.drawText('L', {
    x: margin + 25,
    y: pageHeight - 45,
    size: 20,
    font: helveticaBold,
    color: colors.primaryBlue,
  });

  // Title and org (Headers: 20-24pt, Primary Blue becomes white on dark bg)
  coverPage.drawText('Weekly Brand Visibility Report', {
    x: margin + 80,
    y: pageHeight - 35,
    size: 24,
    font: helveticaBold,
    color: colors.white,
  });

  coverPage.drawText(dto.header.orgName, {
    x: margin + 80,
    y: pageHeight - 55,
    size: 16,
    font: helveticaBold,
    color: colors.backgroundLight,
  });

  const periodText = `${dto.header.periodStart} to ${dto.header.periodEnd}`;
  coverPage.drawText(periodText, {
    x: margin + 80,
    y: pageHeight - 70,
    size: 12,
    font: helveticaFont,
    color: colors.backgroundLight,
  });

  // Executive Summary Card - Large featured metric
  const summaryY = pageHeight - 120;
  drawBrandedCard(coverPage, margin, summaryY, contentWidth, 140, 
    'Executive Summary - Brand Visibility Score', 
    `${dto.kpis.avgVisibilityScore}/10`,
    dto.kpis.deltaVsPriorWeek?.avgVisibilityScore,
    `Based on ${dto.kpis.totalRuns} AI responses analyzed this week`
  );

  // Key Metrics Cards Row (brand styling)
  const cardWidth = (contentWidth - 40) / 3;
  const cardY = summaryY - 170;
  
  drawBrandedCard(coverPage, margin, cardY, cardWidth, 120,
    'Brand Present Rate',
    `${dto.kpis.brandPresentRate}%`,
    dto.kpis.deltaVsPriorWeek?.brandPresentRate,
    'Responses mentioning brand'
  );

  drawBrandedCard(coverPage, margin + cardWidth + 20, cardY, cardWidth, 120,
    'Active Prompts',
    `${dto.prompts.totalActive}`,
    undefined,
    'categories analyzed'
  );

  drawBrandedCard(coverPage, margin + 2 * (cardWidth + 20), cardY, cardWidth, 120,
    'Competitors Detected',
    `${dto.competitors.totalDetected}`,
    undefined,
    `${dto.competitors.newThisWeek.length} new this week`
  );

  // Highlights Box (brand callout styling)
  if (dto.insights.highlights.length > 0) {
    const highlightsY = cardY - 140;
    drawBrandedHighlightsBox(coverPage, margin, highlightsY, contentWidth, dto.insights.highlights);
  }

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

    dto.competitors.byProvider.forEach((provider: any) => {
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

    dto.insights.keyFindings.forEach((finding: any) => {
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

  summaryStats.forEach((stat: any) => {
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
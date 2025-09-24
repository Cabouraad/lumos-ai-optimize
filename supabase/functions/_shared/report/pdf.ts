/**
 * PDF report generation module using pdf-lib
 * Creates clean, branded weekly visibility reports
 */

import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

// Re-export the enhanced PDF renderer and use the same interface
export { renderReportPDF } from './pdf-enhanced.ts';
export type WeeklyReportDTO = any; // Temporarily use any to avoid interface conflicts

// Legacy interface for backwards compatibility
export interface LegacyWeeklyReportDTO {
  header: {
    orgId: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
  };
  kpis: {
    avgVisibilityScore: number;
    totalRuns: number;
    brandPresentRate: number;
    avgCompetitors: number;
    deltaVsPriorWeek?: {
      avgVisibilityScore: number;
      totalRuns: number;
      brandPresentRate: number;
    };
  };
  prompts: {
    totalActive: number;
    topPerformers: Array<{
      id: string;
      text: string;
      avgScore: number;
      totalRuns: number;
      brandPresentRate: number;
    }>;
    poorPerformers: Array<{
      id: string;
      text: string;
      avgScore: number;
      totalRuns: number;
      brandPresentRate: number;
    }>;
    zeroPresence: Array<{
      id: string;
      text: string;
      totalRuns: number;
    }>;
  };
  competitors: {
    totalDetected: number;
    topCompetitors: Array<{
      name: string;
      appearances: number;
      sharePercent: number;
      deltaVsPriorWeek?: number;
    }>;
    avgCompetitorsPerResponse: number;
  };
  recommendations: {
    totalCount: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    highlights: Array<{
      id: string;
      type: string;
      title: string;
      status: string;
    }>;
  };
}

// Legacy renderer - keeping the old implementation intact for now
async function legacyRenderReportPDF(dto: LegacyWeeklyReportDTO): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Color palette
  const primaryColor = rgb(0.2, 0.4, 0.8); // Blue
  const secondaryColor = rgb(0.5, 0.5, 0.5); // Gray
  const successColor = rgb(0.2, 0.7, 0.3); // Green
  const warningColor = rgb(0.9, 0.6, 0.2); // Orange
  const textColor = rgb(0.2, 0.2, 0.2); // Dark gray

  // Page dimensions (A4)
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // Helper functions
  function addFooter(page: any, pageNumber: number) {
    const footerText = `Page ${pageNumber} • Generated ${new Date(dto.header.generatedAt).toLocaleDateString()}`;
    page.drawText(footerText, {
      x: margin,
      y: 30,
      size: 8,
      font: helveticaFont,
      color: secondaryColor,
    });
  }

  function drawBar(page: any, x: number, y: number, width: number, height: number, value: number, maxValue: number, color = primaryColor) {
    const barWidth = Math.max(2, (value / maxValue) * width);
    
    // Background bar
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(0.95, 0.95, 0.95),
    });
    
    // Value bar
    page.drawRectangle({
      x,
      y,
      width: barWidth,
      height,
      color,
    });
  }

  function formatNumber(num: number): string {
    return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  function truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  }

  // PAGE 1: Cover Page
  const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Title
  coverPage.drawText('Weekly Visibility Report', {
    x: margin,
    y: pageHeight - 150,
    size: 32,
    font: helveticaBold,
    color: primaryColor,
  });

  // Organization info
  const orgName = dto.header.orgId.substring(0, 8).toUpperCase(); // Simplified org display
  coverPage.drawText(`Organization: ${orgName}`, {
    x: margin,
    y: pageHeight - 200,
    size: 16,
    font: helveticaFont,
    color: textColor,
  });

  // Period dates
  const periodText = `Period: ${dto.header.periodStart} to ${dto.header.periodEnd}`;
  coverPage.drawText(periodText, {
    x: margin,
    y: pageHeight - 230,
    size: 14,
    font: helveticaFont,
    color: textColor,
  });

  // Summary stats box
  const boxY = pageHeight - 350;
  coverPage.drawRectangle({
    x: margin,
    y: boxY,
    width: contentWidth,
    height: 150,
    color: rgb(0.98, 0.98, 1),
    borderColor: primaryColor,
    borderWidth: 1,
  });

  coverPage.drawText('Report Summary', {
    x: margin + 20,
    y: boxY + 120,
    size: 18,
    font: helveticaBold,
    color: primaryColor,
  });

  const summaryStats = [
    `Average Visibility Score: ${formatNumber(dto.kpis.avgVisibilityScore)}`,
    `Total Prompt Runs: ${formatNumber(dto.kpis.totalRuns)}`,
    `Brand Present Rate: ${formatNumber(dto.kpis.brandPresentRate)}%`,
    `Active Prompts: ${dto.prompts.totalActive}`,
    `Competitors Detected: ${dto.competitors.totalDetected}`,
  ];

  summaryStats.forEach((stat, index) => {
    coverPage.drawText(stat, {
      x: margin + 20,
      y: boxY + 90 - (index * 18),
      size: 12,
      font: helveticaFont,
      color: textColor,
    });
  });

  addFooter(coverPage, 1);

  // PAGE 2: KPIs
  const kpiPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  kpiPage.drawText('Key Performance Indicators', {
    x: margin,
    y: pageHeight - 80,
    size: 24,
    font: helveticaBold,
    color: primaryColor,
  });

  let currentY = pageHeight - 140;

  // Main KPIs with bars
  const kpis = [
    { label: 'Average Visibility Score', value: dto.kpis.avgVisibilityScore, max: 10, delta: dto.kpis.deltaVsPriorWeek?.avgVisibilityScore },
    { label: 'Brand Present Rate (%)', value: dto.kpis.brandPresentRate, max: 100, delta: dto.kpis.deltaVsPriorWeek?.brandPresentRate },
    { label: 'Average Competitors per Response', value: dto.kpis.avgCompetitors, max: 20 },
  ];

  kpis.forEach((kpi, index) => {
    // Label
    kpiPage.drawText(kpi.label, {
      x: margin,
      y: currentY,
      size: 14,
      font: helveticaBold,
      color: textColor,
    });

    // Value
    const valueText = formatNumber(kpi.value);
    kpiPage.drawText(valueText, {
      x: margin + 300,
      y: currentY,
      size: 14,
      font: helveticaBold,
      color: primaryColor,
    });

    // Delta if available
    if (kpi.delta !== undefined) {
      const deltaText = kpi.delta >= 0 ? `+${formatNumber(kpi.delta)}` : formatNumber(kpi.delta);
      const deltaColor = kpi.delta >= 0 ? successColor : warningColor;
      kpiPage.drawText(deltaText, {
        x: margin + 380,
        y: currentY,
        size: 12,
        font: helveticaFont,
        color: deltaColor,
      });
    }

    // Progress bar
    drawBar(kpiPage, margin, currentY - 20, 200, 8, kpi.value, kpi.max);

    currentY -= 80;
  });

  // Volume metrics
  currentY -= 40;
  kpiPage.drawText('Volume Metrics', {
    x: margin,
    y: currentY,
    size: 18,
    font: helveticaBold,
    color: primaryColor,
  });

  currentY -= 40;
  const volumeStats = [
    `Total Runs: ${formatNumber(dto.kpis.totalRuns)}`,
    `Delta vs Previous Week: ${dto.kpis.deltaVsPriorWeek?.totalRuns ? (dto.kpis.deltaVsPriorWeek.totalRuns >= 0 ? '+' : '') + formatNumber(dto.kpis.deltaVsPriorWeek.totalRuns) : 'N/A'}`,
  ];

  volumeStats.forEach(stat => {
    kpiPage.drawText(stat, {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaFont,
      color: textColor,
    });
    currentY -= 25;
  });

  addFooter(kpiPage, 2);

  // PAGE 3: Top Prompts
  const promptsPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  promptsPage.drawText('Prompt Performance Analysis', {
    x: margin,
    y: pageHeight - 80,
    size: 24,
    font: helveticaBold,
    color: primaryColor,
  });

  currentY = pageHeight - 140;

  // Top Performers
  if (dto.prompts.topPerformers.length > 0) {
    promptsPage.drawText('Top Performing Prompts', {
      x: margin,
      y: currentY,
      size: 16,
      font: helveticaBold,
      color: textColor,
    });
    currentY -= 30;

    // Table headers
    const headers = ['Prompt', 'Score', 'Presence %', 'Runs'];
    const columnWidths = [300, 60, 80, 60];
    let currentX = margin;

    headers.forEach((header, index) => {
      promptsPage.drawText(header, {
        x: currentX,
        y: currentY,
        size: 10,
        font: helveticaBold,
        color: secondaryColor,
      });
      currentX += columnWidths[index];
    });
    currentY -= 20;

    // Table rows
    dto.prompts.topPerformers.slice(0, 5).forEach(prompt => {
      currentX = margin;
      
      // Prompt text (truncated)
      promptsPage.drawText(truncateText(prompt.text, 40), {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: textColor,
      });
      currentX += columnWidths[0];

      // Score
      promptsPage.drawText(formatNumber(prompt.avgScore), {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: textColor,
      });
      currentX += columnWidths[1];

      // Presence %
      promptsPage.drawText(`${formatNumber(prompt.brandPresentRate)}%`, {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: textColor,
      });
      currentX += columnWidths[2];

      // Runs
      promptsPage.drawText(formatNumber(prompt.totalRuns), {
        x: currentX,
        y: currentY,
        size: 9,
        font: helveticaFont,
        color: textColor,
      });

      currentY -= 18;
    });
  }

  // Zero Presence Prompts
  if (dto.prompts.zeroPresence.length > 0) {
    currentY -= 40;
    promptsPage.drawText('Prompts with Zero Brand Presence', {
      x: margin,
      y: currentY,
      size: 16,
      font: helveticaBold,
      color: warningColor,
    });
    currentY -= 30;

    dto.prompts.zeroPresence.slice(0, 3).forEach(prompt => {
      promptsPage.drawText(`• ${truncateText(prompt.text, 60)} (${prompt.totalRuns} runs)`, {
        x: margin,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
      currentY -= 18;
    });
  }

  addFooter(promptsPage, 3);

  // PAGE 4: Competitors
  const competitorsPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  competitorsPage.drawText('Competitor Analysis', {
    x: margin,
    y: pageHeight - 80,
    size: 24,
    font: helveticaBold,
    color: primaryColor,
  });

  currentY = pageHeight - 140;

  if (dto.competitors.topCompetitors.length > 0) {
    // Table headers
    const headers = ['Competitor', 'Share %', 'Appearances', 'WoW Change'];
    const columnWidths = [250, 80, 100, 80];
    let currentX = margin;

    headers.forEach((header, index) => {
      competitorsPage.drawText(header, {
        x: currentX,
        y: currentY,
        size: 12,
        font: helveticaBold,
        color: secondaryColor,
      });
      currentX += columnWidths[index];
    });
    currentY -= 25;

    // Top 10 competitors
    const maxAppearances = Math.max(...dto.competitors.topCompetitors.map(c => c.appearances));
    
    dto.competitors.topCompetitors.slice(0, 10).forEach(competitor => {
      currentX = margin;
      
      // Competitor name
      competitorsPage.drawText(truncateText(competitor.name, 30), {
        x: currentX,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
      currentX += columnWidths[0];

      // Share percentage with bar
      competitorsPage.drawText(`${formatNumber(competitor.sharePercent)}%`, {
        x: currentX,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
      
      // Mini bar chart
      drawBar(competitorsPage, currentX, currentY - 12, 60, 4, competitor.sharePercent, 100);
      currentX += columnWidths[1];

      // Appearances
      competitorsPage.drawText(formatNumber(competitor.appearances), {
        x: currentX,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
      currentX += columnWidths[2];

      // Week over week change
      if (competitor.deltaVsPriorWeek !== undefined) {
        const deltaText = competitor.deltaVsPriorWeek >= 0 ? `+${formatNumber(competitor.deltaVsPriorWeek)}` : formatNumber(competitor.deltaVsPriorWeek);
        const deltaColor = competitor.deltaVsPriorWeek >= 0 ? warningColor : successColor;
        competitorsPage.drawText(deltaText, {
          x: currentX,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: deltaColor,
        });
      } else {
        competitorsPage.drawText('N/A', {
          x: currentX,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: secondaryColor,
        });
      }

      currentY -= 20;
    });
  } else {
    competitorsPage.drawText('No competitors detected in this period.', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaFont,
      color: secondaryColor,
    });
  }

  addFooter(competitorsPage, 4);

  // PAGE 5: Recommendations
  const recoPage = pdfDoc.addPage([pageWidth, pageHeight]);
  
  recoPage.drawText('Recommendations Summary', {
    x: margin,
    y: pageHeight - 80,
    size: 24,
    font: helveticaBold,
    color: primaryColor,
  });

  currentY = pageHeight - 140;

  // Summary stats
  recoPage.drawText(`Total Recommendations: ${dto.recommendations.totalCount}`, {
    x: margin,
    y: currentY,
    size: 14,
    font: helveticaBold,
    color: textColor,
  });
  currentY -= 30;

  // By status
  if (Object.keys(dto.recommendations.byStatus).length > 0) {
    recoPage.drawText('By Status:', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
      color: textColor,
    });
    currentY -= 20;

    Object.entries(dto.recommendations.byStatus).forEach(([status, count]) => {
      recoPage.drawText(`• ${status}: ${count}`, {
        x: margin + 20,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
      currentY -= 18;
    });
    currentY -= 10;
  }

  // By type
  if (Object.keys(dto.recommendations.byType).length > 0) {
    recoPage.drawText('By Type:', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
      color: textColor,
    });
    currentY -= 20;

    Object.entries(dto.recommendations.byType).forEach(([type, count]) => {
      recoPage.drawText(`• ${type}: ${count}`, {
        x: margin + 20,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
      currentY -= 18;
    });
    currentY -= 10;
  }

  // Top highlights
  if (dto.recommendations.highlights.length > 0) {
    currentY -= 20;
    recoPage.drawText('Key Recommendations:', {
      x: margin,
      y: currentY,
      size: 12,
      font: helveticaBold,
      color: textColor,
    });
    currentY -= 25;

    dto.recommendations.highlights.slice(0, 3).forEach(reco => {
      const statusColor = reco.status === 'open' ? warningColor : successColor;
      
      recoPage.drawText(`• ${truncateText(reco.title, 70)}`, {
        x: margin + 20,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: textColor,
      });
      
      recoPage.drawText(`[${reco.status.toUpperCase()}]`, {
        x: margin + 450,
        y: currentY,
        size: 8,
        font: helveticaBold,
        color: statusColor,
      });
      
      currentY -= 18;
    });
  }

  addFooter(recoPage, 5);

  // Generate and return PDF bytes
  const pdfBytes = await pdfDoc.save();
  return new Uint8Array(pdfBytes);
}
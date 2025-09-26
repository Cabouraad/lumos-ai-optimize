/**
 * HTML Report Generator for Automated Audit Runs
 * Generates branded HTML reports with audit results
 */

export interface AuditRun {
  id: string;
  started_at: string;
  finished_at?: string;
  status: 'running' | 'passed' | 'failed';
  corr_id: string;
  summary?: any;
  details?: any;
  created_by: string;
}

export interface AuditEvent {
  id: number;
  run_id: string;
  ts: string;
  phase?: string;
  name?: string;
  level?: string;
  data?: any;
}

export function renderAuditHTML(run: AuditRun, events: AuditEvent[]): string {
  const duration = run.finished_at 
    ? Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)
    : 0;

  const statusColor = run.status === 'passed' ? '#10b981' : run.status === 'failed' ? '#ef4444' : '#f59e0b';
  const statusBg = run.status === 'passed' ? '#dcfce7' : run.status === 'failed' ? '#fee2e2' : '#fef3c7';

  // Group events by phase for summary
  const phases = ['signup', 'org', 'pricing', 'checkout', 'entitlement', 'onboarding', 'dashboard'];
  const phaseStats = phases.map(phase => {
    const phaseEvents = events.filter(e => e.phase === phase);
    const hasError = phaseEvents.some(e => e.level === 'error');
    const duration = phaseEvents.length > 0 
      ? Math.max(...phaseEvents.map(e => (e.data as any)?.latency_ms || 0))
      : 0;
    return {
      name: phase,
      status: hasError ? 'failed' : phaseEvents.length > 0 ? 'passed' : 'skipped',
      duration,
      events: phaseEvents.length
    };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audit Report - ${run.corr_id}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: #f9fafb;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            background: white;
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 24px;
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            background: ${statusBg};
            color: ${statusColor};
        }
        .meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }
        .meta-item {
            background: #f3f4f6;
            padding: 12px;
            border-radius: 8px;
        }
        .meta-label {
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .meta-value {
            font-size: 16px;
            font-weight: 500;
            margin-top: 4px;
        }
        .section {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 24px;
            overflow: hidden;
        }
        .section-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 18px;
            font-weight: 600;
        }
        .phase-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1px;
            background: #e5e7eb;
        }
        .phase-card {
            background: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .phase-info h3 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
            text-transform: capitalize;
        }
        .phase-meta {
            font-size: 14px;
            color: #6b7280;
        }
        .phase-status {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .phase-status.passed { background: #dcfce7; color: #166534; }
        .phase-status.failed { background: #fee2e2; color: #991b1b; }
        .phase-status.skipped { background: #f3f4f6; color: #6b7280; }
        .events-table {
            width: 100%;
            border-collapse: collapse;
        }
        .events-table th {
            background: #f9fafb;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid #e5e7eb;
        }
        .events-table td {
            padding: 12px;
            border-bottom: 1px solid #f3f4f6;
            vertical-align: top;
        }
        .events-table tr:hover {
            background: #f9fafb;
        }
        .event-level {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .event-level.info { background: #dbeafe; color: #1e40af; }
        .event-level.warn { background: #fef3c7; color: #d97706; }
        .event-level.error { background: #fee2e2; color: #dc2626; }
        .json-data {
            font-family: 'Monaco', monospace;
            font-size: 12px;
            background: #f3f4f6;
            padding: 8px;
            border-radius: 4px;
            max-width: 400px;
            overflow-x: auto;
        }
        .footer {
            text-align: center;
            padding: 24px;
            color: #6b7280;
            font-size: 14px;
        }
        .collapsible {
            cursor: pointer;
            user-select: none;
        }
        .collapsible:hover {
            background: #f9fafb;
        }
        .collapsible-content {
            display: none;
        }
        .collapsible.expanded .collapsible-content {
            display: table-row-group;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h1>Automated Audit Report</h1>
                <span class="status-badge">${run.status}</span>
            </div>
            <div class="meta">
                <div class="meta-item">
                    <div class="meta-label">Correlation ID</div>
                    <div class="meta-value">${run.corr_id}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Started</div>
                    <div class="meta-value">${new Date(run.started_at).toLocaleString()}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Duration</div>
                    <div class="meta-value">${duration}s</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Events</div>
                    <div class="meta-value">${events.length}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">Phase Summary</div>
            <div class="phase-grid">
                ${phaseStats.map(phase => `
                    <div class="phase-card">
                        <div class="phase-info">
                            <h3>${phase.name}</h3>
                            <div class="phase-meta">${phase.events} events • ${phase.duration}ms</div>
                        </div>
                        <span class="phase-status ${phase.status}">${phase.status}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-header collapsible" onclick="toggleSection(this)">
                Event Timeline (${events.length} events)
                <span style="float: right;">▼</span>
            </div>
            <div class="collapsible-content">
                <table class="events-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Phase</th>
                            <th>Event</th>
                            <th>Level</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${events.map(event => `
                            <tr>
                                <td>${new Date(event.ts).toLocaleTimeString()}</td>
                                <td>${event.phase || '-'}</td>
                                <td>${event.name || '-'}</td>
                                <td><span class="event-level ${event.level || 'info'}">${event.level || 'info'}</span></td>
                                <td>
                                    ${event.data ? `<div class="json-data">${JSON.stringify(event.data, null, 2)}</div>` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="footer">
            <p>Generated by Automated Audit System • ${new Date().toLocaleString()}</p>
            <p>For diagnostics, visit <a href="/functions/v1/diag">/functions/v1/diag</a></p>
        </div>
    </div>

    <script>
        function toggleSection(header) {
            const section = header.parentElement;
            section.classList.toggle('expanded');
            const arrow = header.querySelector('span');
            arrow.textContent = section.classList.contains('expanded') ? '▲' : '▼';
        }
    </script>
</body>
</html>`;
}
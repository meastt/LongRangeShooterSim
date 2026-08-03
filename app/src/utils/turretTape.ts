/**
 * Custom Turret Tape (CDS) PDF HTML Generator.
 *
 * Generates print-ready HTML with physical mm dimensioning for scope elevation turrets.
 * Wraps around scope elevation dials (e.g. Leupold CDS, Vortex, Nightforce).
 *
 * Features:
 *   - Printable tape strip with exact mm dimensions (width = circumference, height = band height)
 *   - Click tick marks for each 0.1 MIL or 1/4 MOA click
 *   - Yardage indicators (e.g. "2" for 200yd, "3" for 300yd) aligned to exact click locations
 *   - Print scale verification bar (1 inch / 50 mm) to ensure 100% 1:1 print scaling
 */

export interface TurretTapeOptions {
  rifleName: string;
  caliber: string;
  bulletName: string;
  weightGrains: number;
  muzzleVelocityFps: number;
  zeroRangeYards: number;
  clicksPerMrad: number; // e.g. 10 for 0.1 MIL, 3.438 for 1/4 MOA
  tapeHeightMm?: number; // Default 12mm
  turretDiameterMm?: number; // Default 30mm (~94.25mm circumference)
  maxRangeYards?: number; // Default 1000yd
  trajectoryRows: Array<{
    rangeYards: number;
    elevHoldMils: number;
  }>;
}

export function generateTurretTapeHtml(options: TurretTapeOptions): string {
  const {
    rifleName,
    caliber,
    bulletName,
    weightGrains,
    muzzleVelocityFps,
    zeroRangeYards,
    clicksPerMrad,
    tapeHeightMm = 12,
    turretDiameterMm = 30,
    maxRangeYards = 1000,
    trajectoryRows,
  } = options;

  const circumferenceMm = Math.PI * turretDiameterMm;

  // Filter rows up to maxRangeYards and step >= zeroRangeYards
  const validRows = trajectoryRows
    .filter((r) => r.rangeYards >= zeroRangeYards && r.rangeYards <= maxRangeYards)
    .sort((a, b) => a.rangeYards - b.rangeYards);

  // Maximum elevation hold in MILs in valid rows
  const maxElevMils = validRows.length > 0 ? validRows[validRows.length - 1].elevHoldMils : 10;
  const maxClicks = Math.ceil(maxElevMils * clicksPerMrad);

  // Each click is spaced evenly along the circumference
  // Assumes turret rotation scale maps maxClicks over available circumference (e.g., 1 full turn ~ 10 MILs)
  const mmPerClick = circumferenceMm / Math.max(maxClicks, 100);

  // Generate tick marks and numbers
  let tickMarksHtml = '';
  let yardageLabelsHtml = '';

  // Standard major tick every 1 MIL (or 10 clicks), minor tick every click
  const clickStep = 1;
  const totalClicksToShow = Math.min(maxClicks + 5, 120);

  for (let c = 0; c <= totalClicksToShow; c++) {
    const xMm = c * mmPerClick;
    if (xMm > circumferenceMm) break;

    const isMajor = c % Math.round(clicksPerMrad) === 0;
    const tickHeight = isMajor ? tapeHeightMm * 0.6 : tapeHeightMm * 0.3;

    tickMarksHtml += `
      <line x1="${xMm.toFixed(2)}" y1="${tapeHeightMm}" x2="${xMm.toFixed(2)}" y2="${(tapeHeightMm - tickHeight).toFixed(2)}" stroke="#000" stroke-width="${isMajor ? 0.6 : 0.3}" />
    `;
  }

  // Position yardage numbers at click locations
  validRows.forEach((row) => {
    const clicks = Math.round(row.elevHoldMils * clicksPerMrad);
    const xMm = clicks * mmPerClick;
    if (xMm <= circumferenceMm) {
      const labelText = row.rangeYards % 100 === 0 ? `${row.rangeYards / 100}` : `${row.rangeYards}`;
      yardageLabelsHtml += `
        <text x="${xMm.toFixed(2)}" y="${(tapeHeightMm * 0.35).toFixed(2)}" font-family="monospace" font-size="3.2" font-weight="bold" text-anchor="middle" fill="#000">${labelText}</text>
      `;
    }
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Turret Tape — ${rifleName}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #111;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 20px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .subtitle {
      font-size: 12px;
      color: #555;
      margin-top: 4px;
    }
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      background: #f5f5f5;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 24px;
      font-size: 11px;
    }
    .spec-item strong {
      display: block;
      color: #666;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tape-section {
      margin-top: 30px;
    }
    .tape-title {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tape-container {
      border: 1px dashed #666;
      padding: 10px;
      display: inline-block;
      background: #fafafa;
    }
    .calibration-bar {
      margin-top: 40px;
      border-top: 1px solid #ccc;
      padding-top: 12px;
    }
    .ruler-line {
      width: 50mm;
      height: 4mm;
      background: repeating-linear-gradient(
        90deg,
        #111,
        #111 0.5mm,
        transparent 0.5mm,
        transparent 5mm
      );
      border-bottom: 1px solid #111;
    }
    .table-container {
      margin-top: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 6px 10px;
      text-align: center;
    }
    th {
      background: #f0f0f0;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9px;
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="title">AIM Custom Scope Turret Tape</div>
    <div class="subtitle">${rifleName} — ${caliber}</div>
  </div>

  <div class="specs-grid">
    <div class="spec-item">
      <strong>Load / Bullet</strong>
      ${bulletName} (${weightGrains}gr)
    </div>
    <div class="spec-item">
      <strong>Muzzle Velocity</strong>
      ${muzzleVelocityFps} fps
    </div>
    <div class="spec-item">
      <strong>Zero Range</strong>
      ${zeroRangeYards} yards
    </div>
    <div class="spec-item">
      <strong>Scope Click Value</strong>
      ${clicksPerMrad === 10 ? '0.1 MIL / click' : `${(1 / clicksPerMrad).toFixed(3)} unit/click`}
    </div>
    <div class="spec-item">
      <strong>Turret Diameter</strong>
      ${turretDiameterMm} mm (${circumferenceMm.toFixed(1)}mm circumference)
    </div>
    <div class="spec-item">
      <strong>Tape Height</strong>
      ${tapeHeightMm} mm
    </div>
  </div>

  <div class="tape-section">
    <div class="tape-title">Cut-Out Turret Band (1:1 Print Scale)</div>
    <div class="tape-container">
      <svg width="${circumferenceMm.toFixed(2)}mm" height="${tapeHeightMm}mm" viewBox="0 0 ${circumferenceMm.toFixed(2)} ${tapeHeightMm}" xmlns="http://www.w3.org/2000/svg">
        <!-- Background -->
        <rect x="0" y="0" width="${circumferenceMm.toFixed(2)}" height="${tapeHeightMm}" fill="#ffffff" stroke="#111111" stroke-width="0.4" />
        <!-- Ticks -->
        ${tickMarksHtml}
        <!-- Labels -->
        ${yardageLabelsHtml}
      </svg>
    </div>
  </div>

  <div class="calibration-bar">
    <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px;">PRINT SCALE VERIFICATION (MUST MEASURE EXACTLY 50 mm)</div>
    <div class="ruler-line"></div>
  </div>

  <div class="table-container">
    <div class="tape-title">DOPE Reference Table</div>
    <table>
      <thead>
        <tr>
          <th>Range (Yd)</th>
          <th>Elev Hold (MIL)</th>
          <th>Clicks</th>
        </tr>
      </thead>
      <tbody>
        ${validRows
          .map(
            (r) => `
          <tr>
            <td><strong>${r.rangeYards}</strong></td>
            <td>${r.elevHoldMils.toFixed(2)}</td>
            <td>${Math.round(r.elevHoldMils * clicksPerMrad)}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  </div>

</body>
</html>
  `;
}

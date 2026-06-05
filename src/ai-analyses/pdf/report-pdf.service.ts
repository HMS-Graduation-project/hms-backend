import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { generateClinicalReport, type ReportLang } from '../report/clinical-report.builder';

const UPLOADS_BASE = path.join(process.cwd(), 'uploads', 'ai', 'pneumonia');
const PAGE_W = 595.28; // A4
const M = 50; // margin
const CW = PAGE_W - 2 * M; // content width

@Injectable()
export class ReportPdfService {
  generateReport(record: any, lang: ReportLang = 'en'): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });

    const report = generateClinicalReport(record.riskLevel, record.analysisMode, record.modelAgreement, lang);
    const L = report.labels;
    const isEnsemble = record.analysisMode === 'ENSEMBLE';
    const prob = (record.probability * 100).toFixed(1);
    const thresh = (record.threshold * 100).toFixed(1);
    const np = record.patientProfile?.nationalPatient;
    const patientName = np ? [np.firstName, np.lastName].filter(Boolean).join(' ') : '---';
    const hospitalName = record.hospital?.name || 'Hospital Management System';
    const requestedBy = record.requestedBy
      ? [record.requestedBy.firstName, record.requestedBy.lastName].filter(Boolean).join(' ') || record.requestedBy.email
      : '---';
    const reviewedBy = record.reviewedBy
      ? [record.reviewedBy.firstName, record.reviewedBy.lastName].filter(Boolean).join(' ') || record.reviewedBy.email
      : null;

    // ════════════════════ PAGE 1 ════════════════════════════════
    this.drawHeader(doc, hospitalName, record.id);
    this.drawMetadataTable(doc, {
      [L.patient]: patientName,
      ...(np?.syrianNationalId ? { [L.nationalId]: np.syrianNationalId } : {}),
      [L.hospital]: hospitalName,
      [L.date]: new Date(record.createdAt).toLocaleDateString('en-GB'),
      [L.type]: L.pneumoniaXray,
      [L.mode]: isEnsemble ? L.ensembleMode : L.singleMode,
      [L.status]: record.status.replace(/_/g, ' '),
      [L.requestedBy]: requestedBy,
      ...(reviewedBy ? { [L.reviewedBy]: reviewedBy } : {}),
    });

    this.drawSummaryBox(doc, record, prob, isEnsemble, L);
    this.drawSection(doc, 'AI Findings', report.aiFindings);
    this.drawSection(doc, 'AI Impression', report.aiImpression);
    this.drawSection(doc, 'Clinical Significance', report.clinicalSignificance);
    this.drawSection(doc, 'Recommendation', report.recommendation);

    // ════════════════════ PAGE 2 ════════════════════════════════
    doc.addPage();
    this.drawHeader(doc, hospitalName, record.id);

    // Model / Ensemble explanation
    if (isEnsemble) {
      this.drawEnsembleSection(doc, record, prob, L);
    } else {
      this.drawSection(doc, 'Model Information',
        'This analysis was performed using the DenseNet121 convolutional neural network model. ' +
        'Model agreement measurement is not available for single-model analysis.');
    }

    // Model Agreement
    this.drawSection(doc, L.modelAgreement, report.modelAgreementText);

    // Grad-CAM
    this.drawExplainability(doc, record, L);

    // Doctor Review
    this.drawDoctorReview(doc, record, reviewedBy, L);

    // Technical Details
    this.drawTechnicalDetails(doc, record, prob, thresh, isEnsemble, L);

    // Disclaimer
    this.drawDisclaimer(doc, report.disclaimer);

    // ── Page numbers ──────────────────────────────────────────
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font('Helvetica').fillColor('#999')
        .text(`Page ${i + 1} of ${pages.count}`, M, 810, { align: 'center', width: CW });
    }

    doc.end();
    return doc;
  }

  // ── Helper Methods ──────────────────────────────────────────────

  private drawHeader(doc: PDFKit.PDFDocument, hospitalName: string, reportId: string) {
    // Top line
    doc.rect(M, M, CW, 3).fill('#2563eb');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#666')
      .text('Hospital Management System', M, M + 10, { align: 'center', width: CW });
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a1a')
      .text('AI-Assisted Radiology Report', { align: 'center', width: CW });
    doc.fontSize(10).font('Helvetica').fillColor('#444')
      .text('Pneumonia Chest X-Ray Analysis', { align: 'center', width: CW });
    doc.moveDown(0.2);
    doc.fontSize(7).font('Helvetica').fillColor('#888')
      .text(`Report ID: ${reportId}  |  Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, { align: 'center', width: CW });
    doc.moveDown(0.3);

    // Separator
    doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.moveDown(0.4);
  }

  private drawMetadataTable(doc: PDFKit.PDFDocument, fields: Record<string, string>) {
    const entries = Object.entries(fields);
    const colW = CW / 2;
    const startY = doc.y;
    let y = startY;

    // Background
    const rowH = 14;
    const totalH = Math.ceil(entries.length / 2) * rowH + 8;
    doc.rect(M, y - 2, CW, totalH).fill('#f8f9fa');

    for (let i = 0; i < entries.length; i++) {
      const [label, value] = entries[i];
      const col = i % 2;
      const x = M + 6 + col * colW;

      if (col === 0 && i > 0) y += rowH;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#555')
        .text(label + ':', x, y, { continued: true, width: colW - 10 })
        .font('Helvetica').fillColor('#111')
        .text(' ' + value);
    }

    doc.y = y + rowH + 6;
    doc.moveDown(0.3);
  }

  private drawSummaryBox(doc: PDFKit.PDFDocument, record: any, prob: string, isEnsemble: boolean, L: any) {
    const y = doc.y;
    const boxH = 70;
    const isPositive = record.prediction === 'PNEUMONIA';

    // Box background
    const bgColor = isPositive ? '#fef2f2' : '#f0fdf4';
    const borderColor = isPositive ? '#dc2626' : '#16a34a';
    doc.rect(M, y, CW, boxH).fill(bgColor);
    doc.rect(M, y, 4, boxH).fill(borderColor);

    // Title
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a1a')
      .text('Executive Clinical Summary', M + 12, y + 6);

    // KPIs in a row
    const kpiY = y + 22;
    const kpis = [
      { label: 'AI Result', value: record.prediction },
      { label: isEnsemble ? 'Final Consensus' : 'Probability', value: `${prob}%` },
      { label: 'Risk Level', value: (record.riskLevel || 'LOW').toUpperCase() },
      { label: 'Review Status', value: record.status.replace(/_/g, ' ') },
    ];
    if (isEnsemble && record.modelAgreement) {
      kpis.splice(3, 0, { label: 'Model Agreement', value: record.modelAgreement });
    }

    const kpiW = (CW - 24) / kpis.length;
    kpis.forEach((kpi, i) => {
      const x = M + 12 + i * kpiW;
      doc.fontSize(7).font('Helvetica').fillColor('#666').text(kpi.label, x, kpiY);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(
        kpi.label === 'AI Result' ? (isPositive ? '#dc2626' : '#16a34a') : '#1a1a1a',
      ).text(kpi.value, x, kpiY + 10);
    });

    // Interpretation line
    const interpY = kpiY + 28;
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#555')
      .text(
        isPositive
          ? 'The AI-assisted analysis indicates patterns consistent with pneumonia. Physician review and clinical correlation are required.'
          : 'The AI-assisted analysis did not detect pneumonia patterns above the screening threshold. Clinical correlation is still recommended.',
        M + 12, interpY, { width: CW - 24 },
      );

    doc.y = y + boxH + 8;
    doc.moveDown(0.2);
  }

  private drawSection(doc: PDFKit.PDFDocument, title: string, text: string) {
    if (doc.y > 720) doc.addPage();

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e3a5f').text(title, M);
    doc.moveDown(0.1);
    doc.moveTo(M, doc.y).lineTo(M + 80, doc.y).strokeColor('#2563eb').lineWidth(1).stroke();
    doc.moveDown(0.2);
    doc.fontSize(9.5).font('Helvetica').fillColor('#333').text(text, M, doc.y, { width: CW, lineGap: 2 });
    doc.moveDown(0.5);
  }

  private drawEnsembleSection(doc: PDFKit.PDFDocument, record: any, prob: string, L: any) {
    this.drawSection(doc, 'Ensemble Analysis Method',
      'This analysis used a weighted average ensemble of three convolutional neural network models trained on pediatric chest X-ray images. ' +
      'Each model independently analyzed the image, and the final consensus probability was calculated using predefined clinical weights.');

    if (!record.modelResultsJson || !Array.isArray(record.modelResultsJson)) return;

    const weights: Record<string, number> = record.ensembleWeightsJson || {};
    const models = record.modelResultsJson as any[];

    // Table header
    const colX = [M, M + 120, M + 210, M + 300, M + 380];
    const headers = ['Model', 'Prediction', 'Probability', 'Weight', 'Contribution'];
    const y = doc.y;

    doc.rect(M, y - 2, CW, 16).fill('#f1f5f9');
    headers.forEach((h, i) => {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151').text(h, colX[i], y, { width: 90 });
    });

    let rowY = y + 18;
    models.forEach((m: any, idx: number) => {
      const w = weights[m.modelName] || 0;
      const mProb = m.probability || 0;
      const contribution = (mProb * w * 100).toFixed(1);

      if (idx % 2 === 0) doc.rect(M, rowY - 2, CW, 14).fill('#fafafa');

      doc.fontSize(8).font('Helvetica').fillColor('#111')
        .text(m.modelName, colX[0], rowY)
        .text(m.prediction, colX[1], rowY)
        .text(`${(mProb * 100).toFixed(1)}%`, colX[2], rowY)
        .text(`${(w * 100).toFixed(0)}%`, colX[3], rowY)
        .text(`${contribution}%`, colX[4], rowY);

      rowY += 14;
    });

    // Final consensus
    doc.rect(M, rowY, CW, 16).fill('#e0f2fe');
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e3a5f')
      .text(`Final Consensus: ${prob}% (Weighted Average)`, M + 6, rowY + 3);

    doc.y = rowY + 24;
    doc.moveDown(0.3);
  }

  private drawExplainability(doc: PDFKit.PDFDocument, record: any, L: any) {
    if (doc.y > 600) doc.addPage();

    this.drawSection(doc, 'Grad-CAM Explainability',
      'Grad-CAM highlights image regions that influenced the AI model prediction. ' +
      'Red/yellow regions indicate higher influence, blue regions indicate lower influence. ' +
      'It is intended to support interpretability and does not replace clinical judgment.');

    if (record.analysisMode === 'ENSEMBLE') {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666')
        .text(L.ensembleGradcamNote, M, doc.y, { width: CW });
      doc.moveDown(0.3);
    }

    const images = [
      { label: L.originalXray, url: record.originalImageUrl },
      { label: L.gradcamHeatmap, url: record.heatmapImageUrl },
      { label: L.gradcamOverlay, url: record.overlayImageUrl },
    ];

    const available = images.filter(img => {
      if (!img.url) return false;
      const fp = this.resolveImagePath(img.url);
      return fp && fs.existsSync(fp);
    });

    if (available.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#888').text(L.noImages, M);
      doc.moveDown(0.3);
      return;
    }

    // Place images — fit up to 3 side by side or stacked
    const imgW = available.length >= 2 ? (CW - 20) / Math.min(available.length, 3) : CW * 0.6;
    const startX = M;
    let imgX = startX;

    doc.fillColor('#000');
    available.forEach((img, i) => {
      const fp = this.resolveImagePath(img.url!);
      if (!fp) return;
      try {
        doc.fontSize(8).font('Helvetica-Bold').text(img.label, imgX, doc.y, { width: imgW });
        doc.image(fp, imgX, doc.y + 2, { width: Math.min(imgW - 5, 160) });
        imgX += imgW + 5;
      } catch {
        doc.fontSize(8).font('Helvetica-Oblique').text(`[Could not load: ${img.label}]`, imgX, doc.y);
      }
    });

    doc.y += 175;
    doc.moveDown(0.5);
  }

  private drawDoctorReview(doc: PDFKit.PDFDocument, record: any, reviewedBy: string | null, L: any) {
    if (doc.y > 680) doc.addPage();

    const y = doc.y;
    const boxH = reviewedBy ? 55 : 35;
    doc.rect(M, y, CW, boxH).fill('#fffbeb');
    doc.rect(M, y, 4, boxH).fill('#d97706');

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#92400e')
      .text(L.physicianReview, M + 12, y + 6);

    if (reviewedBy) {
      doc.fontSize(9).font('Helvetica').fillColor('#333')
        .text(`${L.status}: ${record.status.replace(/_/g, ' ')}`, M + 12, y + 20)
        .text(`${L.reviewedBy}: ${reviewedBy}`, M + 12 + CW / 2, y + 20);
      if (record.reviewedAt) {
        doc.text(`${L.reviewedAt}: ${new Date(record.reviewedAt).toLocaleDateString('en-GB')}`, M + 12, y + 32);
      }
      if (record.doctorComment) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#555')
          .text(`"${record.doctorComment}"`, M + 12, y + 42, { width: CW - 24 });
      }
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#92400e')
        .text(L.pendingReview, M + 12, y + 20);
    }

    doc.y = y + boxH + 8;
    doc.moveDown(0.3);
  }

  private drawTechnicalDetails(doc: PDFKit.PDFDocument, record: any, prob: string, thresh: string, isEnsemble: boolean, L: any) {
    if (doc.y > 700) doc.addPage();

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#888').text(L.technicalDetails, M);
    doc.moveDown(0.1);

    const details = [
      [L.modelVersion, record.modelVersion],
      [L.device, record.device || 'cpu'],
      [L.confidence, `${(record.confidence * 100).toFixed(1)}%`],
      [L.threshold, `${thresh}%`],
      [L.analysisMode, record.analysisMode || 'SINGLE_MODEL'],
    ];
    if (record.ensembleMethod) details.push([L.ensembleMethod, record.ensembleMethod]);
    if (record.agreementScore != null) details.push([L.agreementScore, `${(record.agreementScore * 100).toFixed(0)}%`]);

    doc.fontSize(7.5).font('Helvetica').fillColor('#777');
    details.forEach(([label, value]) => {
      doc.text(`${label}: ${value}`, M);
    });
    doc.moveDown(0.4);
  }

  private drawDisclaimer(doc: PDFKit.PDFDocument, disclaimerText: string) {
    if (doc.y > 740) doc.addPage();

    const y = doc.y;
    doc.moveTo(M, y).lineTo(M + CW, y).strokeColor('#ddd').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    doc.rect(M, doc.y, CW, 42).fill('#fef2f2');
    const boxY = doc.y;

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#991b1b')
      .text('CLINICAL DISCLAIMER', M + 6, boxY + 4, { width: CW - 12, align: 'center' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#7f1d1d')
      .text(disclaimerText, M + 6, boxY + 16, { width: CW - 12, align: 'center' });
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#999')
      .text('This report was generated as part of an AI-assisted hospital management system and should be interpreted within the context of the complete clinical record.',
        M + 6, boxY + 30, { width: CW - 12, align: 'center' });

    doc.y = boxY + 48;
  }

  private resolveImagePath(url: string): string | null {
    if (!url.startsWith('/uploads/ai/pneumonia/')) return null;
    const relativePath = url.replace('/uploads/ai/pneumonia/', '');
    if (relativePath.includes('..')) return null;
    const fullPath = path.join(UPLOADS_BASE, relativePath);
    if (!fullPath.startsWith(UPLOADS_BASE)) return null;
    return fullPath;
  }
}

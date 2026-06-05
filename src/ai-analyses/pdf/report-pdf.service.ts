import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { generateClinicalReport, type ReportLang } from '../report/clinical-report.builder';

const UPLOADS_BASE = path.join(process.cwd(), 'uploads', 'ai', 'pneumonia');

@Injectable()
export class ReportPdfService {
  generateReport(record: any, lang: ReportLang = 'en'): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const report = generateClinicalReport(
      record.riskLevel,
      record.analysisMode,
      record.modelAgreement,
      lang,
    );
    const L = report.labels;

    const risk = (record.riskLevel || 'LOW').toUpperCase();
    const isEnsemble = record.analysisMode === 'ENSEMBLE';
    const prob = (record.probability * 100).toFixed(1);
    const thresh = (record.threshold * 100).toFixed(1);
    const np = record.patientProfile?.nationalPatient;
    const patientName = np ? [np.firstName, np.lastName].filter(Boolean).join(' ') : '---';
    const hospitalName = record.hospital?.name || '---';
    const requestedBy = record.requestedBy
      ? [record.requestedBy.firstName, record.requestedBy.lastName].filter(Boolean).join(' ') || record.requestedBy.email
      : '---';
    const reviewedBy = record.reviewedBy
      ? [record.reviewedBy.firstName, record.reviewedBy.lastName].filter(Boolean).join(' ') || record.reviewedBy.email
      : null;

    // ── Header ────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold')
      .text(report.reportTitle, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica')
      .text(hospitalName, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor('#666')
      .text(`Report ID: ${record.id}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);

    // ── Patient Info ──────────────────────────────────────────
    doc.fillColor('#000');
    this.sectionTitle(doc, L.patient);
    this.row(doc, L.patient, patientName);
    if (np?.syrianNationalId) this.row(doc, L.nationalId, np.syrianNationalId);
    this.row(doc, L.hospital, hospitalName);
    doc.moveDown(0.3);

    // ── Analysis Info ─────────────────────────────────────────
    this.sectionTitle(doc, L.analysisMode);
    this.row(doc, L.date, new Date(record.createdAt).toLocaleString());
    this.row(doc, L.type, L.pneumoniaXray);
    this.row(doc, L.mode, isEnsemble ? L.ensembleMode : L.singleMode);
    this.row(doc, L.status, record.status);
    this.row(doc, L.requestedBy, requestedBy);
    if (reviewedBy) {
      this.row(doc, L.reviewedBy, reviewedBy);
      if (record.reviewedAt) this.row(doc, L.reviewedAt, new Date(record.reviewedAt).toLocaleString());
    }
    doc.moveDown(0.3);

    // ── Clinical Summary ──────────────────────────────────────
    this.sectionTitle(doc, L.prediction);
    this.row(doc, L.prediction, record.prediction);
    this.row(doc, isEnsemble ? L.finalConsensus : L.probability, `${prob}%`);
    this.row(doc, L.riskLevel, risk);
    this.row(doc, L.clinicalThreshold, `${thresh}%`);
    if (isEnsemble && record.modelAgreement) {
      this.row(doc, L.modelAgreement, record.modelAgreement);
      if (record.agreementScore != null) this.row(doc, L.agreementScore, `${(record.agreementScore * 100).toFixed(0)}%`);
    }
    doc.moveDown(0.3);

    // ── Report Sections (from shared builder) ─────────────────
    this.sectionTitle(doc, 'AI Findings');
    doc.fontSize(10).font('Helvetica').text(report.aiFindings);
    doc.moveDown(0.3);

    this.sectionTitle(doc, 'AI Impression');
    doc.fontSize(10).font('Helvetica').text(report.aiImpression);
    doc.moveDown(0.3);

    this.sectionTitle(doc, 'Clinical Significance');
    doc.fontSize(10).font('Helvetica').text(report.clinicalSignificance);
    doc.moveDown(0.3);

    this.sectionTitle(doc, 'Recommendation');
    doc.fontSize(10).font('Helvetica').text(report.recommendation);
    doc.moveDown(0.3);

    // ── Model Agreement ───────────────────────────────────────
    this.sectionTitle(doc, L.modelAgreement);
    doc.fontSize(10).font('Helvetica').text(report.modelAgreementText);
    doc.moveDown(0.3);

    // ── Ensemble Details ──────────────────────────────────────
    if (isEnsemble && record.modelResultsJson && Array.isArray(record.modelResultsJson)) {
      this.sectionTitle(doc, L.ensembleBreakdown);
      const weights = record.ensembleWeightsJson || {};
      for (const m of record.modelResultsJson as any[]) {
        const w = weights[m.modelName] ? `(weight: ${(weights[m.modelName] * 100).toFixed(0)}%)` : '';
        doc.fontSize(9).font('Helvetica')
          .text(`${m.modelName}: ${(m.probability * 100).toFixed(1)}% - ${m.prediction} ${w}`);
      }
      doc.moveDown(0.3);
    }

    // ── Doctor Review ─────────────────────────────────────────
    this.sectionTitle(doc, L.physicianReview);
    if (reviewedBy) {
      this.row(doc, L.status, record.status);
      if (record.doctorComment) {
        doc.fontSize(10).font('Helvetica').text(record.doctorComment);
      }
    } else {
      doc.fontSize(10).font('Helvetica-Oblique').text(L.pendingReview);
    }
    doc.moveDown(0.5);

    // ── Images ────────────────────────────────────────────────
    this.addImages(doc, record, L);

    // ── Technical Details ─────────────────────────────────────
    doc.addPage();
    this.sectionTitle(doc, L.technicalDetails);
    this.row(doc, L.modelVersion, record.modelVersion);
    this.row(doc, L.device, record.device || '---');
    this.row(doc, L.confidence, `${(record.confidence * 100).toFixed(1)}%`);
    this.row(doc, L.threshold, `${thresh}%`);
    this.row(doc, L.analysisMode, record.analysisMode || 'SINGLE_MODEL');
    if (record.ensembleMethod) this.row(doc, L.ensembleMethod, record.ensembleMethod);
    doc.moveDown(0.5);

    // ── Disclaimer ────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#c00')
      .text(L.clinicalDisclaimer, { align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#666')
      .text(report.disclaimer, { align: 'center' });

    doc.end();
    return doc;
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a1a').text(title);
    doc.moveDown(0.2);
  }

  private row(doc: PDFKit.PDFDocument, label: string, value: string) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#555')
      .text(`${label}: `, { continued: true })
      .font('Helvetica').fillColor('#000')
      .text(value);
  }

  private addImages(doc: PDFKit.PDFDocument, record: any, L: any) {
    const images = [
      { label: L.originalXray, url: record.originalImageUrl },
      { label: L.gradcamHeatmap, url: record.heatmapImageUrl },
      { label: L.gradcamOverlay, url: record.overlayImageUrl },
    ];

    const available = images.filter((img) => {
      if (!img.url) return false;
      const filePath = this.resolveImagePath(img.url);
      return filePath && fs.existsSync(filePath);
    });

    if (available.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique').text(L.noImages);
      return;
    }

    doc.addPage();
    this.sectionTitle(doc, L.radiologicalImages);

    if (record.analysisMode === 'ENSEMBLE') {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666')
        .text(L.ensembleGradcamNote);
      doc.moveDown(0.3).fillColor('#000');
    }

    for (const img of available) {
      const filePath = this.resolveImagePath(img.url!);
      if (!filePath) continue;
      try {
        doc.fontSize(10).font('Helvetica-Bold').text(img.label);
        doc.moveDown(0.2);
        doc.image(filePath, { width: 250 });
        doc.moveDown(0.5);
      } catch {
        doc.fontSize(9).font('Helvetica-Oblique')
          .text(`[Image could not be loaded: ${img.label}]`);
        doc.moveDown(0.3);
      }
    }
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

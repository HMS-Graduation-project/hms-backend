import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

const UPLOADS_BASE = path.join(process.cwd(), 'uploads', 'ai', 'pneumonia');

// Deterministic clinical report text (same logic as frontend)
const FINDINGS: Record<string, string> = {
  LOW: 'The AI screening did not detect clear radiological indicators supporting pneumonia in this image.',
  MODERATE: 'The AI screening detected inconclusive radiological indicators that may require clinical correlation.',
  ELEVATED: 'The AI screening detected possible radiological indicators that may be associated with a pneumonia pattern.',
  HIGH: 'The AI screening detected relatively strong radiological indicators that may be consistent with pneumonia.',
};
const IMPRESSION: Record<string, string> = {
  LOW: 'The AI-assisted analysis suggests a low probability of pneumonia.',
  MODERATE: 'The AI-assisted analysis suggests a moderate probability of pneumonia. Clinical evaluation is needed.',
  ELEVATED: 'The AI-assisted analysis suggests an elevated probability of pneumonia, though the result did not exceed the positive classification threshold.',
  HIGH: 'The AI-assisted analysis classifies this result as high suspicion for pneumonia.',
};
const SIGNIFICANCE: Record<string, string> = {
  LOW: 'The result is relatively reassuring, but does not fully exclude disease if clinical symptoms are strong.',
  MODERATE: 'This result should be interpreted alongside symptoms, clinical examination, and inflammatory markers.',
  ELEVATED: 'This result may be clinically significant in the presence of respiratory symptoms such as fever, cough, dyspnea, or decreased oxygen saturation.',
  HIGH: 'This result may require more urgent medical attention depending on the patient condition and overall clinical picture.',
};
const RECOMMENDATION: Record<string, string> = {
  LOW: 'Clinical follow-up is recommended based on the patient condition. The AI result alone should not be relied upon.',
  MODERATE: 'Physician review and clinical correlation are recommended. Additional tests may be needed depending on the case.',
  ELEVATED: 'Specialist physician review is recommended. Correlate with symptoms and laboratory findings before making a final decision.',
  HIGH: 'Clinical evaluation by a specialist physician is recommended. Correlate with the patient clinical picture and accompanying investigations.',
};

const DISCLAIMER = 'This AI-assisted report is not a final diagnosis. Final clinical decision must be made by a qualified physician after clinical correlation.';

@Injectable()
export class ReportPdfService {
  generateReport(record: any): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

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
      .text('AI-Assisted Chest X-Ray Radiology Report', { align: 'center' });
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

    // ── Patient & Analysis Info ────────────────────────────────
    doc.fillColor('#000');
    this.sectionTitle(doc, 'Patient Information');
    this.row(doc, 'Patient', patientName);
    if (np?.syrianNationalId) this.row(doc, 'National ID', np.syrianNationalId);
    this.row(doc, 'Hospital', hospitalName);
    doc.moveDown(0.3);

    this.sectionTitle(doc, 'Analysis Information');
    this.row(doc, 'Date', new Date(record.createdAt).toLocaleString());
    this.row(doc, 'Type', 'Pneumonia Chest X-Ray');
    this.row(doc, 'Mode', isEnsemble ? 'Ensemble (DenseNet121 + EfficientNet-B0 + ResNet50)' : 'Single Model (DenseNet121)');
    this.row(doc, 'Status', record.status);
    this.row(doc, 'Requested By', requestedBy);
    if (reviewedBy) {
      this.row(doc, 'Reviewed By', reviewedBy);
      if (record.reviewedAt) this.row(doc, 'Reviewed At', new Date(record.reviewedAt).toLocaleString());
    }
    doc.moveDown(0.3);

    // ── Clinical Summary ──────────────────────────────────────
    this.sectionTitle(doc, 'Clinical Summary');
    this.row(doc, 'Prediction', record.prediction);
    this.row(doc, isEnsemble ? 'Final Consensus' : 'Probability', `${prob}%`);
    this.row(doc, 'Risk Level', risk);
    this.row(doc, 'Clinical Threshold', `${thresh}%`);
    if (isEnsemble && record.modelAgreement) {
      this.row(doc, 'Model Agreement', record.modelAgreement);
      if (record.agreementScore != null) this.row(doc, 'Agreement Score', `${(record.agreementScore * 100).toFixed(0)}%`);
    }
    doc.moveDown(0.3);

    // ── AI Findings ───────────────────────────────────────────
    this.sectionTitle(doc, 'AI Findings');
    doc.fontSize(10).font('Helvetica').text(FINDINGS[risk] || FINDINGS.LOW);
    doc.moveDown(0.3);

    this.sectionTitle(doc, 'AI Impression');
    doc.fontSize(10).font('Helvetica').text(IMPRESSION[risk] || IMPRESSION.LOW);
    doc.moveDown(0.3);

    this.sectionTitle(doc, 'Clinical Significance');
    doc.fontSize(10).font('Helvetica').text(SIGNIFICANCE[risk] || SIGNIFICANCE.LOW);
    doc.moveDown(0.3);

    this.sectionTitle(doc, 'Recommendation');
    doc.fontSize(10).font('Helvetica').text(RECOMMENDATION[risk] || RECOMMENDATION.LOW);
    doc.moveDown(0.3);

    // ── Ensemble Details ──────────────────────────────────────
    if (isEnsemble && record.modelResultsJson && Array.isArray(record.modelResultsJson)) {
      this.sectionTitle(doc, 'Ensemble Model Breakdown');
      const weights = record.ensembleWeightsJson || {};
      for (const m of record.modelResultsJson as any[]) {
        const w = weights[m.modelName] ? `(weight: ${(weights[m.modelName] * 100).toFixed(0)}%)` : '';
        doc.fontSize(9).font('Helvetica')
          .text(`${m.modelName}: ${(m.probability * 100).toFixed(1)}% - ${m.prediction} ${w}`);
      }
      doc.moveDown(0.3);
    }

    // ── Doctor Review ─────────────────────────────────────────
    this.sectionTitle(doc, 'Physician Review');
    if (reviewedBy) {
      this.row(doc, 'Status', record.status);
      if (record.doctorComment) {
        doc.fontSize(10).font('Helvetica').text(`Comment: ${record.doctorComment}`);
      }
    } else {
      doc.fontSize(10).font('Helvetica-Oblique')
        .text('This result is pending physician review.');
    }
    doc.moveDown(0.5);

    // ── Images ────────────────────────────────────────────────
    this.addImages(doc, record);

    // ── Technical Details ─────────────────────────────────────
    doc.addPage();
    this.sectionTitle(doc, 'Technical Details');
    this.row(doc, 'Model Version', record.modelVersion);
    this.row(doc, 'Device', record.device || '---');
    this.row(doc, 'Confidence', `${(record.confidence * 100).toFixed(1)}%`);
    this.row(doc, 'Threshold', `${thresh}%`);
    this.row(doc, 'Analysis Mode', record.analysisMode || 'SINGLE_MODEL');
    if (record.ensembleMethod) this.row(doc, 'Ensemble Method', record.ensembleMethod);
    doc.moveDown(0.5);

    // ── Disclaimer ────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#c00')
      .text('CLINICAL DISCLAIMER', { align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#666')
      .text(DISCLAIMER, { align: 'center' });

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

  private addImages(doc: PDFKit.PDFDocument, record: any) {
    const images: { label: string; url: string | null }[] = [
      { label: 'Original X-Ray', url: record.originalImageUrl },
      { label: 'Grad-CAM Heatmap', url: record.heatmapImageUrl },
      { label: 'Grad-CAM Overlay', url: record.overlayImageUrl },
    ];

    const available = images.filter((img) => {
      if (!img.url) return false;
      const filePath = this.resolveImagePath(img.url, record.hospitalId);
      return filePath && fs.existsSync(filePath);
    });

    if (available.length === 0) {
      doc.fontSize(10).font('Helvetica-Oblique')
        .text('No explainability images available for this analysis.');
      return;
    }

    // Start images on a new page
    doc.addPage();
    this.sectionTitle(doc, 'Radiological Images');

    if (record.analysisMode === 'ENSEMBLE') {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666')
        .text('Grad-CAM explanation is generated from DenseNet121 default model and does not represent separate explanations for all ensemble models.');
      doc.moveDown(0.3).fillColor('#000');
    }

    for (const img of available) {
      const filePath = this.resolveImagePath(img.url!, record.hospitalId);
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

  private resolveImagePath(url: string, hospitalId: string): string | null {
    // Only allow paths under the uploads/ai/pneumonia directory
    if (!url.startsWith('/uploads/ai/pneumonia/')) return null;

    const relativePath = url.replace('/uploads/ai/pneumonia/', '');
    // Prevent path traversal
    if (relativePath.includes('..')) return null;

    const fullPath = path.join(UPLOADS_BASE, relativePath);
    // Verify the resolved path is still under UPLOADS_BASE
    if (!fullPath.startsWith(UPLOADS_BASE)) return null;

    return fullPath;
  }
}

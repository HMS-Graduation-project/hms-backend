/**
 * Deterministic clinical report text generator.
 *
 * Generates rule-based AI report sections from analysis fields.
 * Used by both PDF service and potentially by API responses.
 * All text is deterministic — no LLM, no hallucination.
 *
 * SNAPSHOT INTEGRITY NOTE:
 * This builder generates text on demand from current code. If report
 * wording changes in a future release, previously generated PDFs would
 * differ from newly generated ones for the same analysis.
 *
 * Future enhancement: persist a `clinicalReportJson` snapshot on the
 * AIAnalysisResult record when the analysis is created or approved.
 * PDF generation should prefer the saved snapshot over re-generation.
 * This ensures report immutability after clinical sign-off.
 *
 * Suggested future schema addition:
 *   clinicalReportJson  Json?  @map("clinical_report_json")
 *   reportVersion       String? @map("report_version")
 */

export type ReportLang = 'en' | 'ar' | 'tr';

export interface ClinicalReportText {
  reportTitle: string;
  patientInformation: string;
  analysisInformation: string;
  clinicalSummary: string;
  aiFindings: string;
  aiImpression: string;
  clinicalSignificance: string;
  recommendation: string;
  modelAgreementText: string;
  disclaimer: string;
  // Section labels
  labels: {
    patient: string;
    nationalId: string;
    hospital: string;
    date: string;
    type: string;
    mode: string;
    status: string;
    requestedBy: string;
    reviewedBy: string;
    reviewedAt: string;
    prediction: string;
    probability: string;
    finalConsensus: string;
    riskLevel: string;
    clinicalThreshold: string;
    modelAgreement: string;
    agreementScore: string;
    ensembleBreakdown: string;
    physicianReview: string;
    technicalDetails: string;
    modelVersion: string;
    device: string;
    confidence: string;
    threshold: string;
    analysisMode: string;
    ensembleMethod: string;
    originalXray: string;
    gradcamHeatmap: string;
    gradcamOverlay: string;
    radiologicalImages: string;
    pendingReview: string;
    singleModelNote: string;
    ensembleGradcamNote: string;
    noImages: string;
    clinicalDisclaimer: string;
    singleMode: string;
    ensembleMode: string;
    pneumoniaXray: string;
  };
}

type RiskTexts = Record<string, string>;

interface LangPack {
  reportTitle: string;
  findings: RiskTexts;
  impression: RiskTexts;
  significance: RiskTexts;
  recommendation: RiskTexts;
  agreementStrong: string;
  agreementModerate: string;
  agreementLow: string;
  agreementSingle: string;
  disclaimer: string;
  labels: ClinicalReportText['labels'];
}

const LANG_PACKS: Record<ReportLang, LangPack> = {
  en: {
    reportTitle: 'AI-Assisted Chest X-Ray Radiology Report',
    findings: {
      LOW: 'The AI screening did not detect clear radiological indicators supporting pneumonia in this image.',
      MODERATE: 'The AI screening detected inconclusive radiological indicators that may require clinical correlation.',
      ELEVATED: 'The AI screening detected possible radiological indicators that may be associated with a pneumonia pattern.',
      HIGH: 'The AI screening detected relatively strong radiological indicators that may be consistent with pneumonia.',
    },
    impression: {
      LOW: 'The AI-assisted analysis suggests a low probability of pneumonia.',
      MODERATE: 'The AI-assisted analysis suggests a moderate probability of pneumonia. Clinical evaluation is needed.',
      ELEVATED: 'The AI-assisted analysis suggests an elevated probability of pneumonia, though the result did not exceed the positive classification threshold.',
      HIGH: 'The AI-assisted analysis classifies this result as high suspicion for pneumonia.',
    },
    significance: {
      LOW: 'The result is relatively reassuring, but does not fully exclude disease if clinical symptoms are strong.',
      MODERATE: 'This result should be interpreted alongside symptoms, clinical examination, and inflammatory markers.',
      ELEVATED: 'This result may be clinically significant in the presence of respiratory symptoms such as fever, cough, dyspnea, or decreased oxygen saturation.',
      HIGH: 'This result may require more urgent medical attention depending on the patient condition and overall clinical picture.',
    },
    recommendation: {
      LOW: 'Clinical follow-up is recommended based on the patient condition. The AI result alone should not be relied upon.',
      MODERATE: 'Physician review and clinical correlation are recommended. Additional tests may be needed depending on the case.',
      ELEVATED: 'Specialist physician review is recommended. Correlate with symptoms and laboratory findings before making a final decision.',
      HIGH: 'Clinical evaluation by a specialist physician is recommended. Correlate with the patient clinical picture and accompanying investigations.',
    },
    agreementStrong: 'There is strong agreement between all three models on the direction of the result.',
    agreementModerate: 'There is moderate agreement between the models. The result should be interpreted with caution and correlated clinically.',
    agreementLow: 'There is low agreement between the models. A thorough medical review is warranted before relying on this result.',
    agreementSingle: 'This result was produced by a single model. Model agreement measurement is not available.',
    disclaimer: 'This AI-assisted report is not a final diagnosis. Final clinical decision must be made by a qualified physician after clinical correlation.',
    labels: {
      patient: 'Patient', nationalId: 'National ID', hospital: 'Hospital',
      date: 'Date', type: 'Type', mode: 'Mode', status: 'Status',
      requestedBy: 'Requested By', reviewedBy: 'Reviewed By', reviewedAt: 'Reviewed At',
      prediction: 'Prediction', probability: 'Probability', finalConsensus: 'Final Consensus',
      riskLevel: 'Risk Level', clinicalThreshold: 'Clinical Threshold',
      modelAgreement: 'Model Agreement', agreementScore: 'Agreement Score',
      ensembleBreakdown: 'Ensemble Model Breakdown', physicianReview: 'Physician Review',
      technicalDetails: 'Technical Details', modelVersion: 'Model Version',
      device: 'Device', confidence: 'Confidence', threshold: 'Threshold',
      analysisMode: 'Analysis Mode', ensembleMethod: 'Ensemble Method',
      originalXray: 'Original X-Ray', gradcamHeatmap: 'Grad-CAM Heatmap',
      gradcamOverlay: 'Grad-CAM Overlay', radiologicalImages: 'Radiological Images',
      pendingReview: 'This result is pending physician review.',
      singleModelNote: 'Single-model analysis. Model agreement is not available.',
      ensembleGradcamNote: 'Grad-CAM explanation is generated from DenseNet121 default model and does not represent separate explanations for all ensemble models.',
      noImages: 'No explainability images available for this analysis.',
      clinicalDisclaimer: 'CLINICAL DISCLAIMER',
      singleMode: 'Single Model (DenseNet121)',
      ensembleMode: 'Ensemble (DenseNet121 + EfficientNet-B0 + ResNet50)',
      pneumoniaXray: 'Pneumonia Chest X-Ray',
    },
  },
  ar: {
    reportTitle: 'تقرير أشعة صدر مدعوم بالذكاء الاصطناعي',
    findings: {
      LOW: 'لم يرصد الذكاء الاصطناعي مؤشرات شعاعية واضحة تدعم وجود التهاب رئوي في هذه الصورة.',
      MODERATE: 'رصد الذكاء الاصطناعي مؤشرات شعاعية غير حاسمة قد تحتاج إلى ربط سريري.',
      ELEVATED: 'رصد الذكاء الاصطناعي مؤشرات شعاعية محتملة قد تكون مرتبطة بنمط التهاب رئوي.',
      HIGH: 'رصد الذكاء الاصطناعي مؤشرات شعاعية قوية نسبياً قد تتوافق مع التهاب رئوي.',
    },
    impression: {
      LOW: 'يشير التحليل المدعوم بالذكاء الاصطناعي إلى احتمال منخفض لوجود التهاب رئوي.',
      MODERATE: 'يشير التحليل المدعوم بالذكاء الاصطناعي إلى احتمال متوسط لوجود التهاب رئوي، مع الحاجة إلى تقييم سريري.',
      ELEVATED: 'يشير التحليل المدعوم بالذكاء الاصطناعي إلى احتمال مرتفع نسبياً لوجود التهاب رئوي، لكن النتيجة لم تتجاوز عتبة التصنيف الإيجابي.',
      HIGH: 'يصنف التحليل المدعوم بالذكاء الاصطناعي النتيجة كاشتباه مرتفع بوجود التهاب رئوي.',
    },
    significance: {
      LOW: 'النتيجة مطمئنة نسبياً، لكنها لا تستبعد المرض بشكل كامل إذا كانت الأعراض السريرية قوية.',
      MODERATE: 'ينبغي تفسير هذه النتيجة مع الأعراض والفحص السريري ومؤشرات الالتهاب.',
      ELEVATED: 'قد تكون هذه النتيجة ذات أهمية سريرية عند وجود أعراض تنفسية مثل الحمى أو السعال أو ضيق النفس أو انخفاض تشبع الأكسجين.',
      HIGH: 'قد تتطلب هذه النتيجة اهتماماً طبياً أسرع حسب حالة المريض والصورة السريرية الكاملة.',
    },
    recommendation: {
      LOW: 'يوصى بالمتابعة السريرية حسب حالة المريض، مع عدم الاعتماد على نتيجة الذكاء الاصطناعي وحدها.',
      MODERATE: 'يوصى بمراجعة الطبيب وربط النتيجة بالفحص السريري، وقد يلزم طلب فحوص إضافية حسب الحالة.',
      ELEVATED: 'يوصى بمراجعة الطبيب المختص وربط النتيجة بالأعراض والتحاليل المخبرية قبل اتخاذ القرار النهائي.',
      HIGH: 'يوصى بتقييم طبي من الطبيب المختص وربط النتيجة بصورة المريض السريرية والتحاليل المرافقة.',
    },
    agreementStrong: 'يوجد اتفاق قوي بين النماذج الثلاثة على اتجاه النتيجة.',
    agreementModerate: 'يوجد اتفاق متوسط بين النماذج، لذلك يجب تفسير النتيجة بحذر وربطها سريرياً.',
    agreementLow: 'يوجد اتفاق منخفض بين النماذج، مما يستدعي مراجعة طبية دقيقة قبل الاعتماد على النتيجة.',
    agreementSingle: 'تم إنتاج هذه النتيجة بواسطة نموذج واحد، لذلك لا يتوفر قياس اتفاق النماذج.',
    disclaimer: 'هذا التقرير مدعوم بالذكاء الاصطناعي ولا يمثل تشخيصاً نهائياً. يجب اتخاذ القرار الطبي النهائي من قبل الطبيب المختص بعد ربط النتيجة بالحالة السريرية.',
    labels: {
      patient: 'المريض', nationalId: 'الرقم الوطني', hospital: 'المستشفى',
      date: 'التاريخ', type: 'النوع', mode: 'نمط التحليل', status: 'الحالة',
      requestedBy: 'طلب بواسطة', reviewedBy: 'راجع بواسطة', reviewedAt: 'تاريخ المراجعة',
      prediction: 'التنبؤ', probability: 'الاحتمال', finalConsensus: 'الإجماع النهائي',
      riskLevel: 'مستوى الخطورة', clinicalThreshold: 'العتبة السريرية',
      modelAgreement: 'اتفاق النماذج', agreementScore: 'درجة الاتفاق',
      ensembleBreakdown: 'تفاصيل نتائج النماذج', physicianReview: 'مراجعة الطبيب',
      technicalDetails: 'التفاصيل التقنية', modelVersion: 'إصدار النموذج',
      device: 'الجهاز', confidence: 'الثقة', threshold: 'العتبة',
      analysisMode: 'نمط التحليل', ensembleMethod: 'طريقة التحليل الجماعي',
      originalXray: 'صورة الأشعة الأصلية', gradcamHeatmap: 'خريطة Grad-CAM',
      gradcamOverlay: 'الصورة التفسيرية المدمجة', radiologicalImages: 'الصور الشعاعية',
      pendingReview: 'هذه النتيجة بانتظار مراجعة الطبيب.',
      singleModelNote: 'تحليل بنموذج واحد. قياس اتفاق النماذج غير متاح.',
      ensembleGradcamNote: 'خريطة Grad-CAM مولدة من نموذج DenseNet121 الافتراضي، ولا تمثل تفسيراً منفصلاً لكل نموذج في التحليل الجماعي.',
      noImages: 'لا توجد صور تفسيرية متاحة لهذا التحليل.',
      clinicalDisclaimer: 'تنبيه سريري',
      singleMode: 'نموذج واحد (DenseNet121)',
      ensembleMode: 'تحليل جماعي (DenseNet121 + EfficientNet-B0 + ResNet50)',
      pneumoniaXray: 'أشعة صدر - التهاب رئوي',
    },
  },
  tr: {
    reportTitle: 'AI Destekli Gogus Rontgeni Radyoloji Raporu',
    findings: {
      LOW: 'AI taramasi bu goruntude pnomoniyi destekleyen net radyolojik gostergeler tespit etmedi.',
      MODERATE: 'AI taramasi klinik korelasyon gerektirebilecek belirsiz radyolojik gostergeler tespit etti.',
      ELEVATED: 'AI taramasi pnomoni paterniyle iliskili olabilecek olasi radyolojik gostergeler tespit etti.',
      HIGH: 'AI taramasi pnomoni ile uyumlu olabilecek nispeten guclu radyolojik gostergeler tespit etti.',
    },
    impression: {
      LOW: 'AI destekli analiz dusuk pnomoni olasiligi onermektedir.',
      MODERATE: 'AI destekli analiz orta duzeyde pnomoni olasiligi onermektedir. Klinik degerlendirme gereklidir.',
      ELEVATED: 'AI destekli analiz yuksek pnomoni olasiligi onermektedir, ancak sonuc pozitif siniflandirma esigini asmamistir.',
      HIGH: 'AI destekli analiz bu sonucu pnomoni icin yuksek supheli olarak siniflandirmaktadir.',
    },
    significance: {
      LOW: 'Sonuc nispeten guven vericidir, ancak klinik belirtiler gucluyse hastalik tamamen dislanamaz.',
      MODERATE: 'Bu sonuc semptomlar, klinik muayene ve enflamasyon belirtecleriyle birlikte yorumlanmalidir.',
      ELEVATED: 'Bu sonuc ates, oksuruk, nefes darligi veya oksijen saturasyonu dususu gibi solunum belirtileri varliginda klinik oneme sahip olabilir.',
      HIGH: 'Bu sonuc hastanin durumuna ve genel klinik tabloya bagli olarak daha acil tibbi ilgi gerektirebilir.',
    },
    recommendation: {
      LOW: 'Hastanin durumuna gore klinik takip onerilir. Yalnizca AI sonucuna guvenilmemelidir.',
      MODERATE: 'Hekim incelemesi ve klinik korelasyon onerilir. Duruma gore ek testler gerekebilir.',
      ELEVATED: 'Uzman hekim incelemesi onerilir. Nihai karar vermeden once semptomlar ve laboratuvar bulgulariyla iliskilendirin.',
      HIGH: 'Uzman hekim tarafindan klinik degerlendirme onerilir. Hastanin klinik tablosu ve eslik eden arastirmalarla iliskilendirin.',
    },
    agreementStrong: 'Uc model arasinda sonucun yonu hakkinda guclu bir uyum vardir.',
    agreementModerate: 'Modeller arasinda orta duzeyde uyum vardir. Sonuc dikkatli yorumlanmali ve klinik olarak iliskilendirilmelidir.',
    agreementLow: 'Modeller arasinda dusuk uyum vardir. Bu sonuca guvenilmeden once kapsamli tibbi inceleme gerekmektedir.',
    agreementSingle: 'Bu sonuc tek bir model tarafindan uretilmistir. Model uyumu olcumu mevcut degildir.',
    disclaimer: 'Bu AI destekli rapor kesin tani degildir. Nihai klinik karar, klinik korelasyon sonrasinda nitelikli bir hekim tarafindan verilmelidir.',
    labels: {
      patient: 'Hasta', nationalId: 'Ulusal Kimlik', hospital: 'Hastane',
      date: 'Tarih', type: 'Tur', mode: 'Analiz Modu', status: 'Durum',
      requestedBy: 'Talep Eden', reviewedBy: 'Inceleyen', reviewedAt: 'Inceleme Tarihi',
      prediction: 'Tahmin', probability: 'Olasilik', finalConsensus: 'Nihai Uzlasi',
      riskLevel: 'Risk Seviyesi', clinicalThreshold: 'Klinik Esik',
      modelAgreement: 'Model Uyumu', agreementScore: 'Uyum Skoru',
      ensembleBreakdown: 'Model Sonuclari', physicianReview: 'Hekim Incelemesi',
      technicalDetails: 'Teknik Detaylar', modelVersion: 'Model Versiyonu',
      device: 'Cihaz', confidence: 'Guven', threshold: 'Esik',
      analysisMode: 'Analiz Modu', ensembleMethod: 'Topluluk Yontemi',
      originalXray: 'Orijinal Rontgen', gradcamHeatmap: 'Grad-CAM Isi Haritasi',
      gradcamOverlay: 'Grad-CAM Kaplama', radiologicalImages: 'Radyolojik Goruntuler',
      pendingReview: 'Bu sonuc hekim incelemesi beklemektedir.',
      singleModelNote: 'Tek model analizi. Model uyumu olcumu mevcut degildir.',
      ensembleGradcamNote: 'Grad-CAM isi haritasi varsayilan DenseNet121 modelinden uretilmistir ve topluluk analizindeki her model icin ayri bir aciklama temsil etmemektedir.',
      noImages: 'Bu analiz icin aciklanabilirlik goruntuleri mevcut degil.',
      clinicalDisclaimer: 'KLINIK UYARI',
      singleMode: 'Tek Model (DenseNet121)',
      ensembleMode: 'Topluluk (DenseNet121 + EfficientNet-B0 + ResNet50)',
      pneumoniaXray: 'Pnomoni Gogus Rontgeni',
    },
  },
};

export function generateClinicalReport(
  riskLevel: string,
  analysisMode: string | null,
  modelAgreement: string | null,
  lang: ReportLang = 'en',
): ClinicalReportText {
  const pack = LANG_PACKS[lang] || LANG_PACKS.en;
  const risk = (riskLevel || 'LOW').toUpperCase();
  const isEnsemble = analysisMode === 'ENSEMBLE';

  let agreementText: string;
  if (!isEnsemble) {
    agreementText = pack.agreementSingle;
  } else if (modelAgreement === 'STRONG') {
    agreementText = pack.agreementStrong;
  } else if (modelAgreement === 'MODERATE') {
    agreementText = pack.agreementModerate;
  } else {
    agreementText = pack.agreementLow;
  }

  return {
    reportTitle: pack.reportTitle,
    patientInformation: pack.labels.patient,
    analysisInformation: pack.labels.date,
    clinicalSummary: pack.labels.prediction,
    aiFindings: pack.findings[risk] || pack.findings.LOW,
    aiImpression: pack.impression[risk] || pack.impression.LOW,
    clinicalSignificance: pack.significance[risk] || pack.significance.LOW,
    recommendation: pack.recommendation[risk] || pack.recommendation.LOW,
    modelAgreementText: agreementText,
    disclaimer: pack.disclaimer,
    labels: pack.labels,
  };
}

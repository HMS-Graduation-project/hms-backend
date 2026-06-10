/**
 * ════════════════════════════════════════════════════════════════════
 *  HMS — National Network Seed (all 14 Syrian governorates)
 * ════════════════════════════════════════════════════════════════════
 *
 * This module is invoked at the end of `prisma/seed.ts`. The base seed
 * builds the rich Damascus + Aleppo + Homs demo (3 cities, 5 hospitals).
 * This module layers a full national network on top so EVERY governorate
 * has multiple, fully-populated hospitals and every dashboard / report /
 * filter looks like a real production system.
 *
 * It is idempotent: each hospital is only populated when it has zero
 * doctors, and the 3 "owned" demo hospitals (DAM-GEN-01, ALP-CTR-01,
 * HOM-REG-01) are never touched here.
 *
 * For each generated hospital it creates: departments, a hospital admin,
 * receptionist, nurse, pharmacist, lab technician, doctors (with weekly
 * schedules), patients (national registry + per-hospital profiles, some
 * with portal logins), appointments across every status, medical records
 * with vital signs, prescriptions + dispensings, a medication inventory
 * (incl. low-stock items), lab orders + results, invoices + payments,
 * wards + beds + admissions (+ a bed transfer), emergency visits across
 * every triage level, AI X-ray analyses, notifications, settings and
 * audit logs. After all hospitals are built it wires cross-governorate
 * referrals so the national referral-flow map has real inter-city edges.
 *
 * Every account created here uses the shared demo password (password123).
 */

import {
  PrismaClient,
  Role,
  AppointmentStatus,
  PrescriptionStatus,
  LabOrderStatus,
  InvoiceStatus,
  PaymentMethod,
  WardType,
  BedStatus,
  AdmissionStatus,
  TriageLevel,
  EmergencyVisitStatus,
  ReferralStatus,
  ReferralUrgency,
  AIAnalysisStatus,
} from '@prisma/client';

export interface NetworkOptions {
  passwordHash: string;
}

// ─── Date helpers ───────────────────────────────────────────────────
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const addDays = (n: number): Date => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d;
};
const atTime = (date: Date, hh: number, mm: number): Date => {
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
};
const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3_600_000);
const minutesAgo = (m: number): Date => new Date(Date.now() - m * 60_000);

// ─── Tiny deterministic RNG (so the network is reproducible) ─────────
function makeRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const pick = <T>(arr: T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length];

// ─── Name pools (Latin + Arabic, paired) ────────────────────────────
interface Name {
  en: string;
  ar: string;
}
const MALE_FIRST: Name[] = [
  { en: 'Ahmad', ar: 'أحمد' }, { en: 'Mohammed', ar: 'محمد' }, { en: 'Omar', ar: 'عمر' },
  { en: 'Khaled', ar: 'خالد' }, { en: 'Yousef', ar: 'يوسف' }, { en: 'Bassel', ar: 'باسل' },
  { en: 'Tarek', ar: 'طارق' }, { en: 'Samer', ar: 'سامر' }, { en: 'Fadi', ar: 'فادي' },
  { en: 'Ghassan', ar: 'غسان' }, { en: 'Walid', ar: 'وليد' }, { en: 'Nabil', ar: 'نبيل' },
  { en: 'Hadi', ar: 'هادي' }, { en: 'Rami', ar: 'رامي' }, { en: 'Ziad', ar: 'زياد' },
  { en: 'Maher', ar: 'ماهر' }, { en: 'Anas', ar: 'أنس' }, { en: 'Wael', ar: 'وائل' },
];
const FEMALE_FIRST: Name[] = [
  { en: 'Fatima', ar: 'فاطمة' }, { en: 'Aisha', ar: 'عائشة' }, { en: 'Layla', ar: 'ليلى' },
  { en: 'Rana', ar: 'رنا' }, { en: 'Nour', ar: 'نور' }, { en: 'Hala', ar: 'هالة' },
  { en: 'Salma', ar: 'سلمى' }, { en: 'Maya', ar: 'مايا' }, { en: 'Lina', ar: 'لينا' },
  { en: 'Reem', ar: 'ريم' }, { en: 'Dana', ar: 'دانة' }, { en: 'Hiba', ar: 'هبة' },
  { en: 'Rasha', ar: 'رشا' }, { en: 'Yara', ar: 'يارا' }, { en: 'Ghada', ar: 'غادة' },
  { en: 'Sawsan', ar: 'سوسن' }, { en: 'Amira', ar: 'أميرة' }, { en: 'Nadia', ar: 'نادية' },
];
const LAST: Name[] = [
  { en: 'Al-Khatib', ar: 'الخطيب' }, { en: 'Haddad', ar: 'حداد' }, { en: 'Nasser', ar: 'ناصر' },
  { en: 'Khoury', ar: 'خوري' }, { en: 'Mansour', ar: 'منصور' }, { en: 'Saleh', ar: 'صالح' },
  { en: 'Darwish', ar: 'درويش' }, { en: 'Sayegh', ar: 'الصايغ' }, { en: 'Ibrahim', ar: 'إبراهيم' },
  { en: 'Hamdan', ar: 'حمدان' }, { en: 'Aziz', ar: 'عزيز' }, { en: 'Suleiman', ar: 'سليمان' },
  { en: 'Najjar', ar: 'النجار' }, { en: 'Halabi', ar: 'الحلبي' }, { en: 'Shami', ar: 'الشامي' },
  { en: 'Kurdi', ar: 'الكردي' }, { en: 'Atassi', ar: 'الأتاسي' }, { en: 'Rifai', ar: 'الرفاعي' },
  { en: 'Barakat', ar: 'بركات' }, { en: 'Hijazi', ar: 'الحجازي' },
];

// ─── Department templates by hospital "kind" ─────────────────────────
interface DeptTpl {
  name: string;
  description: string;
  floor: string;
}
const GENERAL_DEPTS: DeptTpl[] = [
  { name: 'Internal Medicine', description: 'General internal medicine and chronic care', floor: '1' },
  { name: 'Cardiology', description: 'Heart and cardiovascular system', floor: '3' },
  { name: 'General Surgery', description: 'Surgical procedures', floor: '5' },
  { name: 'Emergency Medicine', description: 'Emergency and acute care', floor: 'G' },
  { name: 'Orthopedics', description: 'Bones, joints, and muscles', floor: '2' },
];
const TEACHING_DEPTS: DeptTpl[] = [
  { name: 'Internal Medicine', description: 'General internal medicine and chronic care', floor: '1' },
  { name: 'Cardiology', description: 'Heart and cardiovascular system', floor: '3' },
  { name: 'Neurology', description: 'Brain and nervous system', floor: '4' },
  { name: 'Pediatrics', description: 'Children and infant care', floor: '2' },
  { name: 'General Surgery', description: 'Surgical procedures', floor: '5' },
  { name: 'Radiology', description: 'Medical imaging and diagnostics', floor: 'B1' },
];
const CHILDREN_DEPTS: DeptTpl[] = [
  { name: 'Pediatrics', description: 'Children and infant care', floor: '1' },
  { name: 'Neonatology', description: 'Newborn and premature infant care', floor: '2' },
  { name: 'Pediatric Surgery', description: 'Surgical care for children', floor: '3' },
  { name: 'Pediatric Cardiology', description: 'Congenital and pediatric heart care', floor: '3' },
  { name: 'Emergency Medicine', description: 'Pediatric emergency care', floor: 'G' },
];
const MATERNITY_DEPTS: DeptTpl[] = [
  { name: 'Obstetrics & Gynecology', description: 'Pregnancy, childbirth and women health', floor: '2' },
  { name: 'Neonatology', description: 'Newborn and premature infant care', floor: '2' },
  { name: 'Internal Medicine', description: 'General internal medicine', floor: '1' },
  { name: 'General Surgery', description: 'Surgical procedures', floor: '4' },
];
const CARDIAC_DEPTS: DeptTpl[] = [
  { name: 'Cardiology', description: 'Heart and cardiovascular system', floor: '2' },
  { name: 'Cardiac Surgery', description: 'Open-heart and cardiac surgical procedures', floor: '4' },
  { name: 'Internal Medicine', description: 'General internal medicine', floor: '1' },
  { name: 'Emergency Medicine', description: 'Cardiac emergency care', floor: 'G' },
];

type Kind = 'general' | 'teaching' | 'childrens' | 'maternity' | 'cardiac';
const DEPTS_BY_KIND: Record<Kind, DeptTpl[]> = {
  general: GENERAL_DEPTS,
  teaching: TEACHING_DEPTS,
  childrens: CHILDREN_DEPTS,
  maternity: MATERNITY_DEPTS,
  cardiac: CARDIAC_DEPTS,
};

const SPECIALIZATION: Record<string, string> = {
  'Internal Medicine': 'Internist',
  'Cardiology': 'Cardiologist',
  'General Surgery': 'General Surgeon',
  'Emergency Medicine': 'Emergency Physician',
  'Orthopedics': 'Orthopedic Surgeon',
  'Neurology': 'Neurologist',
  'Pediatrics': 'Pediatrician',
  'Radiology': 'Radiologist',
  'Neonatology': 'Neonatologist',
  'Pediatric Surgery': 'Pediatric Surgeon',
  'Pediatric Cardiology': 'Pediatric Cardiologist',
  'Obstetrics & Gynecology': 'Obstetrician-Gynecologist',
  'Cardiac Surgery': 'Cardiac Surgeon',
};

// ─── Clinical content pools ──────────────────────────────────────────
interface ClinicalCase {
  reason: string;
  chiefComplaint: string;
  presentIllness: string;
  examination: string;
  diagnosis: string;
  icd: string;
  treatmentPlan: string;
}
const CASES: ClinicalCase[] = [
  { reason: 'Chest pain on exertion', chiefComplaint: 'Chest pain', presentIllness: 'Intermittent retrosternal chest pain for 3 days, worse with effort.', examination: 'Normal heart sounds. ECG: normal sinus rhythm.', diagnosis: 'Hypertension', icd: 'I10', treatmentPlan: 'Start Amlodipine 5mg daily, lifestyle changes, review in 2 weeks.' },
  { reason: 'Recurrent headache', chiefComplaint: 'Persistent headache', presentIllness: 'Throbbing headaches 3-4x/week for a month with photophobia.', examination: 'Neuro exam normal. Fundoscopy unremarkable.', diagnosis: 'Migraine without aura', icd: 'G43.0', treatmentPlan: 'Sumatriptan PRN, prophylactic Topiramate 25mg, headache diary.' },
  { reason: 'Knee pain and swelling', chiefComplaint: 'Joint pain', presentIllness: 'Right knee pain and swelling for 2 weeks with stiffness.', examination: 'Moderate effusion, reduced ROM. McMurray negative.', diagnosis: 'Osteoarthritis of knee', icd: 'M17.1', treatmentPlan: 'NSAIDs, physiotherapy referral, consider intra-articular injection.' },
  { reason: 'Shortness of breath', chiefComplaint: 'Dyspnea', presentIllness: 'Progressive exertional dyspnea over 2 months.', examination: 'Bilateral basal crackles. SpO2 94% RA.', diagnosis: 'Congestive heart failure — mild', icd: 'I50.9', treatmentPlan: 'Furosemide 20mg daily, echocardiography, low-salt diet.' },
  { reason: 'High blood sugar', chiefComplaint: 'Polyuria and thirst', presentIllness: 'Polyuria, polydipsia, 4kg weight loss over 3 weeks.', examination: 'Mild dehydration, BMI 32, acanthosis nigricans.', diagnosis: 'Type 2 Diabetes Mellitus', icd: 'E11.9', treatmentPlan: 'Metformin 500mg BID, diabetic diet, HbA1c monitoring, education.' },
  { reason: 'Productive cough and fever', chiefComplaint: 'Cough with sputum', presentIllness: 'Productive cough, yellow sputum, low-grade fever for 5 days.', examination: 'Right basal crackles. Temp 37.8°C, SpO2 96%.', diagnosis: 'Community-acquired pneumonia', icd: 'J18.9', treatmentPlan: 'Amoxicillin-clavulanate 625mg TID 7d, chest X-ray, hydration.' },
  { reason: 'Abdominal pain', chiefComplaint: 'Epigastric pain', presentIllness: 'Burning epigastric pain after meals for 4 weeks.', examination: 'Soft abdomen, mild epigastric tenderness.', diagnosis: 'Gastroesophageal reflux disease', icd: 'K21.0', treatmentPlan: 'Omeprazole 20mg daily, dietary advice, avoid late meals.' },
  { reason: 'Fatigue and weight gain', chiefComplaint: 'Chronic fatigue', presentIllness: 'Fatigue, 5kg weight gain, cold intolerance for 2 months.', examination: 'Diffuse goitre, dry skin, delayed reflexes.', diagnosis: 'Hypothyroidism', icd: 'E03.9', treatmentPlan: 'Levothyroxine 50mcg daily, recheck TFTs in 6 weeks.' },
  { reason: 'Back pain', chiefComplaint: 'Lower back pain', presentIllness: 'Lower back pain radiating to left leg after lifting.', examination: 'Positive SLR at 45° left, L4-L5 tenderness.', diagnosis: 'Lumbar disc herniation', icd: 'M51.1', treatmentPlan: 'NSAIDs, muscle relaxant, physiotherapy, MRI lumbar spine.' },
  { reason: 'Sore throat and fever', chiefComplaint: 'Recurrent fever', presentIllness: 'Low-grade fever and sore throat for 10 days.', examination: 'Erythematous pharynx, cervical lymphadenopathy.', diagnosis: 'Acute tonsillopharyngitis', icd: 'J03.9', treatmentPlan: 'Amoxicillin 500mg TID 7d, rest, fluids, paracetamol.' },
  { reason: 'Numbness in feet', chiefComplaint: 'Numbness in extremities', presentIllness: 'Tingling and numbness in both feet for 3 months.', examination: 'Reduced sensation, stocking distribution.', diagnosis: 'Diabetic peripheral neuropathy', icd: 'G63.2', treatmentPlan: 'Optimize glycemic control, Pregabalin 75mg BID.' },
];

interface PrescTpl {
  status: PrescriptionStatus;
  notes: string;
  items: Array<{ medicationName: string; dosage: string; frequency: string; duration: string; quantity: number; instructions: string }>;
}
const PRESCRIPTIONS: PrescTpl[] = [
  { status: PrescriptionStatus.DISPENSED, notes: 'Take with meals. Avoid alcohol.', items: [
    { medicationName: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily', duration: '30 days', quantity: 30, instructions: 'Take in the morning' },
    { medicationName: 'Aspirin 100mg', dosage: '100mg', frequency: 'Once daily', duration: '90 days', quantity: 90, instructions: 'Take after dinner' },
  ] },
  { status: PrescriptionStatus.DISPENSED, notes: 'Monitor for side effects.', items: [
    { medicationName: 'Metformin 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '90 days', quantity: 180, instructions: 'Take with meals' },
    { medicationName: 'Atorvastatin 20mg', dosage: '20mg', frequency: 'Once daily', duration: '90 days', quantity: 90, instructions: 'Take at night' },
  ] },
  { status: PrescriptionStatus.PENDING, notes: 'Complete the full course.', items: [
    { medicationName: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'Three times daily', duration: '7 days', quantity: 21, instructions: 'Evenly spaced; finish the course' },
    { medicationName: 'Paracetamol 500mg', dosage: '1000mg', frequency: 'Every 6 hours PRN', duration: '5 days', quantity: 20, instructions: 'Max 4g/day' },
  ] },
  { status: PrescriptionStatus.PARTIALLY_DISPENSED, notes: 'Return for physiotherapy review.', items: [
    { medicationName: 'Ibuprofen 400mg', dosage: '400mg', frequency: 'Three times daily', duration: '14 days', quantity: 42, instructions: 'Take with food' },
    { medicationName: 'Omeprazole 20mg', dosage: '20mg', frequency: 'Once daily', duration: '14 days', quantity: 14, instructions: 'Before breakfast' },
  ] },
  { status: PrescriptionStatus.DISPENSED, notes: 'Thyroid recheck in 6 weeks.', items: [
    { medicationName: 'Levothyroxine 50mcg', dosage: '50mcg', frequency: 'Once daily', duration: '90 days', quantity: 90, instructions: 'Empty stomach, 30 min before breakfast' },
  ] },
];

interface LabTpl {
  testName: string;
  testCategory: string;
  status: LabOrderStatus;
  priority: string;
  result?: { result: string; normalRange: string; unit: string; isAbnormal: boolean };
}
const LABS: LabTpl[] = [
  { testName: 'Complete Blood Count', testCategory: 'Hematology', status: LabOrderStatus.COMPLETED, priority: 'NORMAL', result: { result: 'WBC 7.2, Hgb 14.5, Plt 250', normalRange: 'WBC 4-11, Hgb 12-16, Plt 150-400', unit: 'x10^3/uL', isAbnormal: false } },
  { testName: 'Blood Glucose (Fasting)', testCategory: 'Biochemistry', status: LabOrderStatus.COMPLETED, priority: 'URGENT', result: { result: '142', normalRange: '70-100', unit: 'mg/dL', isAbnormal: true } },
  { testName: 'Lipid Panel', testCategory: 'Biochemistry', status: LabOrderStatus.COMPLETED, priority: 'NORMAL', result: { result: 'TC 220, LDL 145, HDL 42', normalRange: 'TC<200, LDL<100, HDL>40', unit: 'mg/dL', isAbnormal: true } },
  { testName: 'Thyroid Panel (TSH, T3, T4)', testCategory: 'Endocrinology', status: LabOrderStatus.COMPLETED, priority: 'NORMAL', result: { result: 'TSH 8.5, FT4 0.7', normalRange: 'TSH 0.4-4.0, FT4 0.8-1.8', unit: 'mIU/L', isAbnormal: true } },
  { testName: 'Urinalysis', testCategory: 'Pathology', status: LabOrderStatus.IN_PROGRESS, priority: 'NORMAL' },
  { testName: 'HbA1c', testCategory: 'Biochemistry', status: LabOrderStatus.IN_PROGRESS, priority: 'URGENT' },
  { testName: 'Renal Function Panel', testCategory: 'Biochemistry', status: LabOrderStatus.SAMPLE_COLLECTED, priority: 'NORMAL' },
  { testName: 'C-Reactive Protein', testCategory: 'Immunology', status: LabOrderStatus.ORDERED, priority: 'NORMAL' },
  { testName: 'Cardiac Enzymes (Troponin)', testCategory: 'Biochemistry', status: LabOrderStatus.ORDERED, priority: 'STAT' },
  { testName: 'Chest X-Ray Report', testCategory: 'Radiology', status: LabOrderStatus.ORDERED, priority: 'NORMAL' },
];

interface MedTpl {
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  unit: string;
  price: number;
  stock: number;
  reorderLevel: number;
  lowStock?: boolean;
}
const MEDS: MedTpl[] = [
  { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotic', manufacturer: 'Tamico', dosageForm: 'Capsule', strength: '500mg', unit: 'capsule', price: 12.5, stock: 500, reorderLevel: 50 },
  { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'NSAID', manufacturer: 'Ultra Medica', dosageForm: 'Tablet', strength: '400mg', unit: 'tablet', price: 8.75, stock: 800, reorderLevel: 100 },
  { name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'PPI', manufacturer: 'Asia Pharma', dosageForm: 'Capsule', strength: '20mg', unit: 'capsule', price: 15, stock: 400, reorderLevel: 40 },
  { name: 'Metformin 500mg', genericName: 'Metformin HCl', category: 'Antidiabetic', manufacturer: 'Unipharma', dosageForm: 'Tablet', strength: '500mg', unit: 'tablet', price: 6.25, stock: 1200, reorderLevel: 120 },
  { name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', category: 'Calcium Channel Blocker', manufacturer: 'Ibn Al-Haytham', dosageForm: 'Tablet', strength: '5mg', unit: 'tablet', price: 10, stock: 600, reorderLevel: 60 },
  { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic', manufacturer: 'Tamico', dosageForm: 'Tablet', strength: '500mg', unit: 'tablet', price: 4.5, stock: 2000, reorderLevel: 200 },
  { name: 'Aspirin 100mg', genericName: 'Acetylsalicylic Acid', category: 'Antiplatelet', manufacturer: 'Bayer', dosageForm: 'Tablet', strength: '100mg', unit: 'tablet', price: 5, stock: 1000, reorderLevel: 100 },
  { name: 'Atorvastatin 20mg', genericName: 'Atorvastatin', category: 'Statin', manufacturer: 'Ultra Medica', dosageForm: 'Tablet', strength: '20mg', unit: 'tablet', price: 22, stock: 350, reorderLevel: 35 },
  { name: 'Levothyroxine 50mcg', genericName: 'Levothyroxine Sodium', category: 'Thyroid Hormone', manufacturer: 'Merck', dosageForm: 'Tablet', strength: '50mcg', unit: 'tablet', price: 9.5, stock: 700, reorderLevel: 70 },
  { name: 'Ceftriaxone 1g', genericName: 'Ceftriaxone', category: 'Antibiotic', manufacturer: 'Asia Pharma', dosageForm: 'Injection', strength: '1g', unit: 'vial', price: 35, stock: 25, reorderLevel: 40, lowStock: true },
  { name: 'Insulin Glargine', genericName: 'Insulin Glargine', category: 'Antidiabetic', manufacturer: 'Sanofi', dosageForm: 'Pen', strength: '100U/mL', unit: 'pen', price: 120, stock: 18, reorderLevel: 30, lowStock: true },
  { name: 'Salbutamol Inhaler', genericName: 'Salbutamol', category: 'Bronchodilator', manufacturer: 'Unipharma', dosageForm: 'Inhaler', strength: '100mcg', unit: 'inhaler', price: 28, stock: 8, reorderLevel: 25, lowStock: true },
];

// ─── Vital sign profiles ─────────────────────────────────────────────
const VITALS = [
  { temperature: 36.6, s: 120, d: 80, hr: 72, rr: 16, spo2: 98, w: 75, h: 175 },
  { temperature: 37.2, s: 140, d: 90, hr: 88, rr: 18, spo2: 97, w: 68, h: 162 },
  { temperature: 36.8, s: 118, d: 76, hr: 65, rr: 14, spo2: 99, w: 82, h: 180 },
  { temperature: 38.1, s: 125, d: 82, hr: 98, rr: 22, spo2: 96, w: 77, h: 172 },
  { temperature: 36.5, s: 110, d: 70, hr: 60, rr: 15, spo2: 98, w: 55, h: 158 },
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const ALLERGIES = [null, 'Penicillin', null, 'Aspirin', null, 'Sulfa drugs', null, 'Latex', null, 'Peanuts'];
const INSURERS = [null, 'National Social Insurance', 'Syrian Insurance Co.', null, 'Al-Aqeelah Takaful', 'Military Insurance'];

// ════════════════════════════════════════════════════════════════════
//  Hospital catalog — 14 governorates, multiple hospitals each
// ════════════════════════════════════════════════════════════════════
interface HospitalSpec {
  code: string;
  name: string;
  nameAr: string;
  city: string; // must match a seeded City.name
  address: string;
  phone: string;
  kind: Kind;
}

// Hospitals owned by the base seed (prisma/seed.ts) — never populated here.
const PROTECTED = new Set(['DAM-GEN-01', 'ALP-CTR-01', 'HOM-REG-01']);

const HOSPITALS: HospitalSpec[] = [
  // ── Damascus ──
  { code: 'DAM-CHL-01', name: "Damascus Children's Hospital", nameAr: 'مستشفى دمشق للأطفال', city: 'Damascus', address: 'Al-Mujtahid Square, Damascus', phone: '+963-11-6620-100', kind: 'childrens' },
  { code: 'DAM-MWS-01', name: 'Al-Mouwasat University Hospital', nameAr: 'مستشفى المواساة الجامعي', city: 'Damascus', address: 'Mazzeh, Damascus', phone: '+963-11-6620-200', kind: 'teaching' },
  { code: 'DAM-MJT-01', name: 'Al-Mujtahid Hospital', nameAr: 'مستشفى المجتهد', city: 'Damascus', address: 'Al-Mujtahid, Damascus', phone: '+963-11-6620-300', kind: 'general' },
  // ── Rural Damascus ──
  { code: 'RDM-DOU-01', name: 'Douma Central Hospital', nameAr: 'مستشفى دوما المركزي', city: 'Rural Damascus', address: 'Douma, Rural Damascus', phone: '+963-11-7100-100', kind: 'general' },
  { code: 'RDM-ZBD-01', name: 'Al-Zabadani National Hospital', nameAr: 'مستشفى الزبداني الوطني', city: 'Rural Damascus', address: 'Al-Zabadani, Rural Damascus', phone: '+963-11-7100-200', kind: 'general' },
  { code: 'RDM-QTN-01', name: 'Al-Qutayfah Maternity Hospital', nameAr: 'مستشفى القطيفة للولادة', city: 'Rural Damascus', address: 'Al-Qutayfah, Rural Damascus', phone: '+963-11-7100-300', kind: 'maternity' },
  // ── Aleppo ──
  { code: 'ALP-UNI-01', name: 'Aleppo University Hospital', nameAr: 'مستشفى جامعة حلب', city: 'Aleppo', address: 'University Boulevard, Aleppo', phone: '+963-21-5550-200', kind: 'teaching' },
  { code: 'ALP-RAZ-01', name: 'Al-Razi Hospital', nameAr: 'مستشفى الرازي', city: 'Aleppo', address: 'Central Aleppo', phone: '+963-21-5550-300', kind: 'general' },
  { code: 'ALP-CHL-01', name: "Aleppo Children's Hospital", nameAr: 'مستشفى حلب للأطفال', city: 'Aleppo', address: 'Al-Sabil, Aleppo', phone: '+963-21-5550-400', kind: 'childrens' },
  { code: 'MNB-NAT-01', name: 'Manbij National Hospital', nameAr: 'مستشفى منبج الوطني', city: 'Manbij', address: 'Manbij, Aleppo', phone: '+963-21-5560-100', kind: 'general' },
  // ── Homs ──
  { code: 'HOM-WTN-01', name: 'Al-Watani Hospital Homs', nameAr: 'المستشفى الوطني بحمص', city: 'Homs', address: 'Central Homs', phone: '+963-31-4440-200', kind: 'general' },
  { code: 'HOM-BSL-01', name: 'Al-Basel Heart Center', nameAr: 'مركز الباسل للقلب', city: 'Homs', address: 'Western Homs', phone: '+963-31-4440-300', kind: 'cardiac' },
  { code: 'HOM-ZAH-01', name: 'Al-Zahrawi Maternity Hospital', nameAr: 'مستشفى الزهراوي للولادة', city: 'Homs', address: 'Al-Waer, Homs', phone: '+963-31-4440-400', kind: 'maternity' },
  // ── Hama ──
  { code: 'HMA-NAT-01', name: 'Hama National Hospital', nameAr: 'مستشفى حماة الوطني', city: 'Hama', address: 'Central Hama', phone: '+963-33-2220-100', kind: 'general' },
  { code: 'HMA-HRT-01', name: 'Al-Horani Hospital', nameAr: 'مستشفى الحوراني', city: 'Hama', address: 'Al-Horani St, Hama', phone: '+963-33-2220-200', kind: 'teaching' },
  { code: 'HMA-MHR-01', name: 'Al-Mahardah General Hospital', nameAr: 'مستشفى محردة العام', city: 'Hama', address: 'Al-Mahardah, Hama', phone: '+963-33-2220-300', kind: 'general' },
  // ── Latakia ──
  { code: 'LAT-TSH-01', name: 'Tishreen University Hospital', nameAr: 'مستشفى تشرين الجامعي', city: 'Latakia', address: 'University Campus, Latakia', phone: '+963-41-4780-100', kind: 'teaching' },
  { code: 'LAT-NAT-01', name: 'Latakia National Hospital', nameAr: 'مستشفى اللاذقية الوطني', city: 'Latakia', address: 'Central Latakia', phone: '+963-41-4780-200', kind: 'general' },
  { code: 'JBL-NAT-01', name: 'Jableh National Hospital', nameAr: 'مستشفى جبلة الوطني', city: 'Jableh', address: 'Jableh, Latakia', phone: '+963-41-4790-100', kind: 'general' },
  // ── Tartus ──
  { code: 'TAR-NAT-01', name: 'Tartus National Hospital', nameAr: 'المستشفى الوطني بطرطوس', city: 'Tartus', address: 'Central Tartus', phone: '+963-43-3210-100', kind: 'general' },
  { code: 'TAR-BSL-01', name: 'Al-Basel Hospital Tartus', nameAr: 'مستشفى الباسل بطرطوس', city: 'Tartus', address: 'Al-Thawra St, Tartus', phone: '+963-43-3210-200', kind: 'teaching' },
  { code: 'BNS-NAT-01', name: 'Baniyas National Hospital', nameAr: 'مستشفى بانياس الوطني', city: 'Baniyas', address: 'Baniyas, Tartus', phone: '+963-43-3220-100', kind: 'general' },
  // ── Idlib ──
  { code: 'IDL-CTR-01', name: 'Idlib Central Hospital', nameAr: 'مستشفى إدلب المركزي', city: 'Idlib', address: 'Central Idlib', phone: '+963-23-2110-100', kind: 'general' },
  { code: 'IDL-UNI-01', name: 'Idlib University Hospital', nameAr: 'مستشفى إدلب الجامعي', city: 'Idlib', address: 'University Rd, Idlib', phone: '+963-23-2110-200', kind: 'teaching' },
  { code: 'IDL-MRT-01', name: "Maaret al-Numan National Hospital", nameAr: 'مستشفى معرة النعمان الوطني', city: 'Idlib', address: 'Maaret al-Numan, Idlib', phone: '+963-23-2110-300', kind: 'general' },
  // ── Daraa ──
  { code: 'DAR-NAT-01', name: 'Daraa National Hospital', nameAr: 'مستشفى درعا الوطني', city: 'Daraa', address: 'Central Daraa', phone: '+963-15-2310-100', kind: 'general' },
  { code: 'DAR-IZR-01', name: 'Izra National Hospital', nameAr: 'مستشفى إزرع الوطني', city: 'Daraa', address: 'Izra, Daraa', phone: '+963-15-2310-200', kind: 'general' },
  { code: 'DAR-CHL-01', name: "Daraa Children's Hospital", nameAr: 'مستشفى درعا للأطفال', city: 'Daraa', address: 'Al-Sad Rd, Daraa', phone: '+963-15-2310-300', kind: 'childrens' },
  // ── As-Suwayda ──
  { code: 'SWD-NAT-01', name: 'As-Suwayda National Hospital', nameAr: 'مستشفى السويداء الوطني', city: 'As-Suwayda', address: 'Central As-Suwayda', phone: '+963-16-2210-100', kind: 'general' },
  { code: 'SWD-BSL-01', name: 'Al-Basel Hospital Suwayda', nameAr: 'مستشفى الباسل بالسويداء', city: 'As-Suwayda', address: 'Al-Maqwas, As-Suwayda', phone: '+963-16-2210-200', kind: 'teaching' },
  { code: 'SWD-MTR-01', name: 'Suwayda Maternity & Children Hospital', nameAr: 'مستشفى السويداء للولادة والأطفال', city: 'As-Suwayda', address: 'Al-Thawra St, As-Suwayda', phone: '+963-16-2210-300', kind: 'maternity' },
  // ── Quneitra ──
  { code: 'QUN-NAT-01', name: 'Quneitra National Hospital', nameAr: 'مستشفى القنيطرة الوطني', city: 'Quneitra', address: 'Khan Arnabah, Quneitra', phone: '+963-14-2010-100', kind: 'general' },
  { code: 'QUN-BAT-01', name: 'Al-Baath Hospital Quneitra', nameAr: 'مستشفى البعث بالقنيطرة', city: 'Quneitra', address: 'Quneitra', phone: '+963-14-2010-200', kind: 'general' },
  // ── Deir ez-Zor ──
  { code: 'DEZ-NAT-01', name: 'Deir ez-Zor National Hospital', nameAr: 'مستشفى دير الزور الوطني', city: 'Deir ez-Zor', address: 'Central Deir ez-Zor', phone: '+963-51-2210-100', kind: 'general' },
  { code: 'DEZ-UNI-01', name: 'Deir ez-Zor University Hospital', nameAr: 'مستشفى دير الزور الجامعي', city: 'Deir ez-Zor', address: 'University Rd, Deir ez-Zor', phone: '+963-51-2210-200', kind: 'teaching' },
  { code: 'DEZ-MYD-01', name: 'Al-Mayadin General Hospital', nameAr: 'مستشفى الميادين العام', city: 'Deir ez-Zor', address: 'Al-Mayadin, Deir ez-Zor', phone: '+963-51-2210-300', kind: 'general' },
  // ── Al-Hasakah ──
  { code: 'HAS-NAT-01', name: 'Al-Hasakah National Hospital', nameAr: 'مستشفى الحسكة الوطني', city: 'Al-Hasakah', address: 'Central Al-Hasakah', phone: '+963-52-3110-100', kind: 'general' },
  { code: 'HAS-CHL-01', name: "Al-Hasakah Children's Hospital", nameAr: 'مستشفى الحسكة للأطفال', city: 'Al-Hasakah', address: 'Al-Aziziyah, Al-Hasakah', phone: '+963-52-3110-200', kind: 'childrens' },
  { code: 'QAM-NAT-01', name: 'Qamishli National Hospital', nameAr: 'مستشفى القامشلي الوطني', city: 'Qamishli', address: 'Central Qamishli', phone: '+963-52-3120-100', kind: 'teaching' },
  // ── Raqqa ──
  { code: 'RAQ-NAT-01', name: 'Raqqa National Hospital', nameAr: 'مستشفى الرقة الوطني', city: 'Raqqa', address: 'Central Raqqa', phone: '+963-22-2210-100', kind: 'general' },
  { code: 'RAQ-BSL-01', name: 'Al-Basel Hospital Raqqa', nameAr: 'مستشفى الباسل بالرقة', city: 'Raqqa', address: 'Al-Mansour St, Raqqa', phone: '+963-22-2210-200', kind: 'general' },
  { code: 'RAQ-TBQ-01', name: 'Al-Tabqa General Hospital', nameAr: 'مستشفى الطبقة العام', city: 'Raqqa', address: 'Al-Tabqa, Raqqa', phone: '+963-22-2210-300', kind: 'general' },
];

// ─── Result refs collected per hospital, used for cross-network wiring ─
interface DoctorRef {
  profileId: string;
  userId: string;
  departmentId: string | null;
  name: string;
  specialization: string;
}
interface PatientRef {
  profileId: string;
  nationalPatientId: string;
  userId: string | null;
  name: string;
}
interface HospitalResult {
  hospitalId: string;
  code: string;
  cityId: string;
  cityName: string;
  doctors: DoctorRef[];
  patients: PatientRef[];
}

// ════════════════════════════════════════════════════════════════════
//  Per-hospital population
// ════════════════════════════════════════════════════════════════════
async function populateHospital(
  prisma: PrismaClient,
  hospitalId: string,
  spec: HospitalSpec,
  hIdx: number,
  hash: string,
): Promise<HospitalResult & { cityId: string }> {
  const rng = makeRng(hIdx * 101 + 7);
  const codeLower = spec.code.toLowerCase();
  const cityRow = await prisma.hospital.findUniqueOrThrow({ where: { id: hospitalId }, select: { cityId: true } });
  const cityId = cityRow.cityId;

  // ── Departments ──
  const deptTpls = DEPTS_BY_KIND[spec.kind];
  const departments: Array<{ id: string; name: string }> = [];
  for (const t of deptTpls) {
    const d = await prisma.department.upsert({
      where: { hospitalId_name: { hospitalId, name: t.name } },
      update: {},
      create: { hospitalId, name: t.name, description: t.description, floor: t.floor, phone: spec.phone },
    });
    departments.push({ id: d.id, name: d.name });
  }

  // ── Support staff ──
  const mkStaffName = (offset: number, female: boolean): Name => {
    const first = female ? pick(FEMALE_FIRST, hIdx * 3 + offset) : pick(MALE_FIRST, hIdx * 3 + offset);
    return { en: `${first.en} ${pick(LAST, hIdx * 5 + offset).en}`, ar: '' };
  };
  const adminName = mkStaffName(0, hIdx % 2 === 0);
  const admin = await prisma.user.upsert({
    where: { email: `admin.${codeLower}@hms.com` },
    update: { role: Role.HOSPITAL_ADMIN, hospitalId },
    create: { email: `admin.${codeLower}@hms.com`, passwordHash: hash, role: Role.HOSPITAL_ADMIN, firstName: adminName.en.split(' ')[0], lastName: adminName.en.split(' ')[1], phone: spec.phone, hospitalId },
  });
  const reception = await prisma.user.upsert({
    where: { email: `reception.${codeLower}@hms.com` },
    update: { role: Role.RECEPTIONIST, hospitalId },
    create: { email: `reception.${codeLower}@hms.com`, passwordHash: hash, role: Role.RECEPTIONIST, firstName: mkStaffName(1, true).en.split(' ')[0], lastName: mkStaffName(1, true).en.split(' ')[1], hospitalId, gender: 'Female' },
  });
  const nurse = await prisma.user.upsert({
    where: { email: `nurse.${codeLower}@hms.com` },
    update: { role: Role.NURSE, hospitalId },
    create: { email: `nurse.${codeLower}@hms.com`, passwordHash: hash, role: Role.NURSE, firstName: mkStaffName(2, true).en.split(' ')[0], lastName: mkStaffName(2, true).en.split(' ')[1], hospitalId, gender: 'Female' },
  });
  const pharmacist = await prisma.user.upsert({
    where: { email: `pharmacist.${codeLower}@hms.com` },
    update: { role: Role.PHARMACIST, hospitalId },
    create: { email: `pharmacist.${codeLower}@hms.com`, passwordHash: hash, role: Role.PHARMACIST, firstName: mkStaffName(3, false).en.split(' ')[0], lastName: mkStaffName(3, false).en.split(' ')[1], hospitalId, gender: 'Male' },
  });
  const labTech = await prisma.user.upsert({
    where: { email: `lab.${codeLower}@hms.com` },
    update: { role: Role.LAB_TECHNICIAN, hospitalId },
    create: { email: `lab.${codeLower}@hms.com`, passwordHash: hash, role: Role.LAB_TECHNICIAN, firstName: mkStaffName(4, true).en.split(' ')[0], lastName: mkStaffName(4, true).en.split(' ')[1], hospitalId, gender: 'Female' },
  });

  // ── Doctors (one per department, plus extras up to 6) ──
  const DOCTORS_PER = 6;
  const doctors: DoctorRef[] = [];
  for (let i = 0; i < DOCTORS_PER; i++) {
    const dept = departments[i % departments.length];
    const female = (hIdx + i) % 2 === 0;
    const first = female ? pick(FEMALE_FIRST, hIdx * 7 + i) : pick(MALE_FIRST, hIdx * 7 + i);
    const last = pick(LAST, hIdx * 11 + i + 3);
    const email = `dr.${i + 1}.${codeLower}@hms.com`;
    const spz = SPECIALIZATION[dept.name] ?? dept.name;
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: Role.DOCTOR, hospitalId },
      create: { email, passwordHash: hash, role: Role.DOCTOR, firstName: first.en, lastName: last.en, phone: spec.phone, gender: female ? 'Female' : 'Male', hospitalId },
    });
    const profile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: { specialization: spz, departmentId: dept.id, hospitalId },
      create: {
        userId: user.id,
        specialization: spz,
        licenseNumber: `SY-${spec.code}-D${i + 1}`,
        departmentId: dept.id,
        bio: `${spz} at ${spec.name}.`,
        yearsExperience: 5 + Math.floor(rng() * 20),
        consultationFee: 100 + Math.floor(rng() * 6) * 25,
        hospitalId,
      },
    });
    doctors.push({ profileId: profile.id, userId: user.id, departmentId: dept.id, name: `${first.en} ${last.en}`, specialization: spz });

    // Weekly schedule: most Sun–Thu 09:00–17:00; one afternoon shift.
    const days = i === 5 ? [0, 1, 2, 3, 4, 6] : [0, 1, 2, 3, 4];
    const startT = i === 4 ? '13:00' : '09:00';
    const endT = i === 4 ? '21:00' : '17:00';
    for (const day of days) {
      await prisma.doctorSchedule.upsert({
        where: { doctorId_dayOfWeek: { doctorId: profile.id, dayOfWeek: day } },
        update: { startTime: startT, endTime: endT, slotDuration: 30, hospitalId },
        create: { doctorId: profile.id, dayOfWeek: day, startTime: startT, endTime: endT, slotDuration: 30, hospitalId },
      });
    }
  }

  // ── Patients (national registry + per-hospital profile; some with login) ──
  const PATIENTS_PER = 12;
  const PATIENTS_WITH_LOGIN = 4;
  const patients: PatientRef[] = [];
  for (let i = 0; i < PATIENTS_PER; i++) {
    const female = (hIdx + i) % 3 === 0;
    const first = female ? pick(FEMALE_FIRST, hIdx * 13 + i) : pick(MALE_FIRST, hIdx * 13 + i);
    const last = pick(LAST, hIdx * 17 + i);
    const dob = new Date(1955 + ((hIdx * 3 + i * 7) % 55), (i * 5) % 12, ((i * 11) % 27) + 1);
    const syrianNationalId = String(20_000_000_000 + hIdx * 1000 + i); // 11 digits, unique, distinct from base seed
    const bloodType = pick(BLOOD_TYPES, hIdx + i);
    const allergy = pick(ALLERGIES, hIdx * 2 + i);

    const np = await prisma.nationalPatient.upsert({
      where: { syrianNationalId },
      update: {},
      create: {
        syrianNationalId,
        firstName: first.en,
        lastName: last.en,
        firstNameAr: first.ar,
        lastNameAr: last.ar,
        dateOfBirth: dob,
        gender: female ? 'Female' : 'Male',
        bloodType,
        allergies: allergy,
        chronicConditions: i % 4 === 0 ? 'Hypertension' : i % 5 === 0 ? 'Diabetes Mellitus' : null,
        criticalAlerts: allergy ? `Allergy: ${allergy}` : null,
        phone: `+963-9${String(30 + (hIdx % 60))}-${String(100000 + hIdx * 100 + i).slice(-6)}`,
        address: `${spec.city}, Syria`,
      },
    });

    let userId: string | null = null;
    if (i < PATIENTS_WITH_LOGIN) {
      const email = `patient.${i + 1}.${codeLower}@hms.com`;
      const u = await prisma.user.upsert({
        where: { email },
        update: { role: Role.PATIENT, hospitalId },
        create: { email, passwordHash: hash, role: Role.PATIENT, firstName: first.en, lastName: last.en, gender: female ? 'Female' : 'Male', dateOfBirth: dob, hospitalId },
      });
      userId = u.id;
    }

    const profile = await prisma.patientProfile.upsert({
      where: { hospitalId_nationalPatientId: { hospitalId, nationalPatientId: np.id } },
      update: { userId: userId ?? undefined },
      create: {
        userId,
        nationalPatientId: np.id,
        bloodType,
        allergies: allergy,
        emergencyContactName: `${pick(MALE_FIRST, i).en} ${last.en}`,
        emergencyContactPhone: `+963-9${String(40 + (hIdx % 50))}-${String(200000 + i).slice(-6)}`,
        emergencyContactRelation: pick(['Spouse', 'Father', 'Mother', 'Sibling'], i),
        insuranceProvider: pick(INSURERS, hIdx + i),
        insurancePolicyNumber: pick(INSURERS, hIdx + i) ? `POL-${spec.code}-${1000 + i}` : null,
        hospitalId,
      },
    });
    patients.push({ profileId: profile.id, nationalPatientId: np.id, userId, name: `${first.en} ${last.en}` });
  }

  // ── Appointments across every status, spread over time ──
  type ApptPlan = { status: AppointmentStatus; offset: number; hh: number; mm: number };
  const plans: ApptPlan[] = [];
  for (let i = 0; i < 7; i++) plans.push({ status: AppointmentStatus.COMPLETED, offset: -(i * 4 + 3), hh: 9 + (i % 6), mm: i % 2 ? 30 : 0 });
  for (let i = 0; i < 5; i++) plans.push({ status: AppointmentStatus.CONFIRMED, offset: i + 2, hh: 9 + (i % 6), mm: i % 2 ? 30 : 0 });
  for (let i = 0; i < 5; i++) plans.push({ status: AppointmentStatus.PENDING, offset: i + 4, hh: 10 + (i % 5), mm: i % 2 ? 30 : 0 });
  for (let i = 0; i < 3; i++) plans.push({ status: AppointmentStatus.IN_PROGRESS, offset: 0, hh: 9 + i, mm: 0 });
  for (let i = 0; i < 2; i++) plans.push({ status: AppointmentStatus.CANCELLED, offset: -(i + 1), hh: 11 + i, mm: 0 });
  for (let i = 0; i < 2; i++) plans.push({ status: AppointmentStatus.NO_SHOW, offset: -(i + 6), hh: 14 + i, mm: 0 });

  const apptTypes = ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY'];
  const cancelReasons = ['Patient requested cancellation', 'Scheduling conflict', 'Travel emergency'];
  const apptRows = plans.map((p, i) => {
    const doc = doctors[i % doctors.length];
    const pat = patients[i % patients.length];
    const date = addDays(p.offset);
    const endMm = p.mm + 30;
    const endHh = p.hh + Math.floor(endMm / 60);
    const cse = pick(CASES, hIdx + i);
    return {
      patientId: pat.profileId,
      doctorId: doc.profileId,
      departmentId: doc.departmentId,
      hospitalId,
      date,
      startTime: `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`,
      endTime: `${String(endHh).padStart(2, '0')}:${String(endMm % 60).padStart(2, '0')}`,
      status: p.status,
      type: pick(apptTypes, i),
      reason: cse.reason,
      notes: p.status === AppointmentStatus.COMPLETED ? 'Visit completed.' : null,
      cancelReason: p.status === AppointmentStatus.CANCELLED ? pick(cancelReasons, i) : null,
    };
  });
  await prisma.appointment.createMany({ data: apptRows });
  const completed = await prisma.appointment.findMany({
    where: { hospitalId, status: AppointmentStatus.COMPLETED },
    orderBy: { date: 'asc' },
  });

  // ── Medical records + vitals for completed appointments ──
  const records: Array<{ id: string; patientId: string; doctorId: string }> = [];
  for (let i = 0; i < completed.length; i++) {
    const appt = completed[i];
    const cse = pick(CASES, hIdx + i);
    const rec = await prisma.medicalRecord.create({
      data: {
        appointmentId: appt.id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        hospitalId,
        chiefComplaint: cse.chiefComplaint,
        presentIllness: cse.presentIllness,
        examination: cse.examination,
        diagnosis: cse.diagnosis,
        icdCodes: cse.icd,
        treatmentPlan: cse.treatmentPlan,
        notes: 'Patient education provided. Return if symptoms worsen.',
      },
    });
    records.push({ id: rec.id, patientId: appt.patientId, doctorId: appt.doctorId });
    if (i < 4) {
      const v = pick(VITALS, hIdx + i);
      await prisma.vitalSigns.create({
        data: {
          medicalRecordId: rec.id,
          temperature: v.temperature,
          bloodPressureSystolic: v.s,
          bloodPressureDiastolic: v.d,
          heartRate: v.hr,
          respiratoryRate: v.rr,
          oxygenSaturation: v.spo2,
          weight: v.w,
          height: v.h,
        },
      });
    }
  }

  // ── Medications inventory (some low-stock) ──
  for (const m of MEDS) {
    const existing = await prisma.medication.findFirst({ where: { hospitalId, name: m.name } });
    if (!existing) {
      await prisma.medication.create({
        data: {
          hospitalId,
          name: m.name,
          genericName: m.genericName,
          category: m.category,
          manufacturer: m.manufacturer,
          dosageForm: m.dosageForm,
          strength: m.strength,
          unit: m.unit,
          price: m.price,
          stock: m.stock,
          reorderLevel: m.reorderLevel,
          expiryDate: addDays(180 + Math.floor(rng() * 540)),
        },
      });
    }
  }

  // ── Prescriptions (+ dispensings for dispensed ones) ──
  const prescriptions: Array<{ id: string; status: PrescriptionStatus }> = [];
  for (let i = 0; i < Math.min(PRESCRIPTIONS.length, records.length); i++) {
    const rec = records[i];
    const tpl = PRESCRIPTIONS[i];
    const p = await prisma.prescription.create({
      data: {
        medicalRecordId: rec.id,
        patientId: rec.patientId,
        doctorId: rec.doctorId,
        hospitalId,
        status: tpl.status,
        notes: tpl.notes,
        items: { create: tpl.items },
      },
    });
    prescriptions.push({ id: p.id, status: p.status });

    if (tpl.status === PrescriptionStatus.DISPENSED || tpl.status === PrescriptionStatus.PARTIALLY_DISPENSED) {
      for (const item of tpl.items) {
        const med = await prisma.medication.findFirst({ where: { hospitalId, name: item.medicationName } });
        if (med && item.quantity && med.stock >= item.quantity) {
          await prisma.dispensing.create({
            data: { prescriptionId: p.id, medicationId: med.id, quantity: item.quantity, pharmacistId: pharmacist.id, hospitalId, dispensedAt: hoursAgo(2 + i) },
          });
          await prisma.medication.update({ where: { id: med.id }, data: { stock: { decrement: item.quantity } } });
        }
        if (tpl.status === PrescriptionStatus.PARTIALLY_DISPENSED) break; // only first item for partial
      }
    }
  }

  // ── Lab orders (+ results) ──
  for (let i = 0; i < LABS.length; i++) {
    const tpl = LABS[i];
    const rec = records[i % Math.max(records.length, 1)] ?? null;
    const pat = patients[i % patients.length];
    const doc = doctors[i % doctors.length];
    const order = await prisma.labOrder.create({
      data: {
        medicalRecordId: rec ? rec.id : null,
        patientId: rec ? rec.patientId : pat.profileId,
        doctorId: rec ? rec.doctorId : doc.profileId,
        hospitalId,
        testName: tpl.testName,
        testCategory: tpl.testCategory,
        status: tpl.status,
        priority: tpl.priority,
        notes: tpl.status === LabOrderStatus.COMPLETED ? 'Reviewed by ordering physician.' : null,
        completedAt: tpl.status === LabOrderStatus.COMPLETED ? addDays(-1) : null,
      },
    });
    if (tpl.result) {
      await prisma.labResult.create({
        data: {
          labOrderId: order.id,
          result: tpl.result.result,
          normalRange: tpl.result.normalRange,
          unit: tpl.result.unit,
          isAbnormal: tpl.result.isAbnormal,
          technicianId: labTech.id,
          notes: tpl.result.isAbnormal ? 'Abnormal — physician notified.' : 'Within normal range.',
        },
      });
    }
  }

  // ── Invoices (+ payments) ──
  const invoicePlans: Array<{ status: InvoiceStatus; items: Array<{ description: string; category: string; quantity: number; unitPrice: number }>; partial?: number }> = [
    { status: InvoiceStatus.PAID, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 150 }, { description: 'ECG', category: 'PROCEDURE', quantity: 1, unitPrice: 75 }] },
    { status: InvoiceStatus.PAID, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 200 }, { description: 'Complete Blood Count', category: 'LAB_TEST', quantity: 1, unitPrice: 45 }] },
    { status: InvoiceStatus.PAID, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 175 }, { description: 'X-Ray', category: 'PROCEDURE', quantity: 1, unitPrice: 120 }] },
    { status: InvoiceStatus.ISSUED, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 250 }, { description: 'Echocardiography', category: 'PROCEDURE', quantity: 1, unitPrice: 350 }] },
    { status: InvoiceStatus.ISSUED, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 200 }, { description: 'Lipid Panel', category: 'LAB_TEST', quantity: 1, unitPrice: 60 }] },
    { status: InvoiceStatus.PARTIALLY_PAID, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 200 }, { description: 'Ultrasound', category: 'PROCEDURE', quantity: 1, unitPrice: 200 }, { description: 'Medications', category: 'MEDICATION', quantity: 1, unitPrice: 85 }], partial: 200 },
    { status: InvoiceStatus.DRAFT, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 180 }, { description: 'Holter Monitor', category: 'PROCEDURE', quantity: 1, unitPrice: 180 }] },
    { status: InvoiceStatus.OVERDUE, items: [{ description: 'Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 220 }, { description: 'MRI', category: 'PROCEDURE', quantity: 1, unitPrice: 500 }] },
  ];
  for (let i = 0; i < invoicePlans.length; i++) {
    const plan = invoicePlans[i];
    const pat = patients[i % patients.length];
    const appt = completed[i % Math.max(completed.length, 1)] ?? null;
    const subtotal = plan.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const total = subtotal + tax;
    const paidAmount = plan.status === InvoiceStatus.PAID ? total : plan.status === InvoiceStatus.PARTIALLY_PAID ? (plan.partial ?? 0) : 0;
    const dateStr = addDays(-(i + 1)).toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = `INV-${dateStr}-${String(hIdx * 100 + i + 1).padStart(4, '0')}`;
    const payments =
      plan.status === InvoiceStatus.PAID
        ? [{ amount: total, method: pick([PaymentMethod.CASH, PaymentMethod.CREDIT_CARD, PaymentMethod.INSURANCE], i), reference: `PAY-${invoiceNumber}`, paidAt: addDays(-i) }]
        : plan.status === InvoiceStatus.PARTIALLY_PAID
          ? [{ amount: plan.partial ?? 0, method: PaymentMethod.BANK_TRANSFER, reference: `PAY-${invoiceNumber}`, paidAt: addDays(-i) }]
          : [];
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        patientId: pat.profileId,
        appointmentId: appt ? appt.id : null,
        hospitalId,
        status: plan.status,
        subtotal,
        tax,
        discount: 0,
        total,
        paidAmount,
        issuedAt: plan.status !== InvoiceStatus.DRAFT ? addDays(-(i + 1)) : null,
        dueDate: plan.status === InvoiceStatus.OVERDUE ? addDays(-3) : plan.status !== InvoiceStatus.DRAFT ? addDays(30 - i) : null,
        items: { create: plan.items.map((it) => ({ description: it.description, category: it.category, quantity: it.quantity, unitPrice: it.unitPrice, total: it.unitPrice * it.quantity })) },
        payments: { create: payments },
      },
    });
  }

  // ── Wards + beds + admissions (+ a transfer) ──
  const wardA = await prisma.ward.upsert({
    where: { hospitalId_name: { hospitalId, name: 'General Ward A' } },
    update: {},
    create: { hospitalId, name: 'General Ward A', type: WardType.GENERAL, departmentId: departments[0].id, floor: '1', description: 'General inpatient ward' },
  });
  const icu = await prisma.ward.upsert({
    where: { hospitalId_name: { hospitalId, name: 'ICU' } },
    update: {},
    create: { hospitalId, name: 'ICU', type: WardType.ICU, floor: '2', description: 'Intensive Care Unit' },
  });
  const wardC =
    spec.kind === 'childrens'
      ? await prisma.ward.upsert({ where: { hospitalId_name: { hospitalId, name: 'Pediatric Ward' } }, update: {}, create: { hospitalId, name: 'Pediatric Ward', type: WardType.PEDIATRIC, floor: '1' } })
      : spec.kind === 'maternity'
        ? await prisma.ward.upsert({ where: { hospitalId_name: { hospitalId, name: 'Maternity Ward' } }, update: {}, create: { hospitalId, name: 'Maternity Ward', type: WardType.MATERNITY, floor: '2' } })
        : await prisma.ward.upsert({ where: { hospitalId_name: { hospitalId, name: 'Surgical Ward' } }, update: {}, create: { hospitalId, name: 'Surgical Ward', type: WardType.POST_OP, floor: '4' } });

  const bedSpecs: Array<{ wardId: string; number: string }> = [];
  for (let i = 1; i <= 8; i++) bedSpecs.push({ wardId: wardA.id, number: `A-${String(i).padStart(2, '0')}` });
  for (let i = 1; i <= 4; i++) bedSpecs.push({ wardId: icu.id, number: `ICU-${String(i).padStart(2, '0')}` });
  for (let i = 1; i <= 6; i++) bedSpecs.push({ wardId: wardC.id, number: `C-${String(i).padStart(2, '0')}` });
  await prisma.bed.createMany({ data: bedSpecs.map((b) => ({ hospitalId, wardId: b.wardId, number: b.number, status: BedStatus.AVAILABLE })) });

  const wardABeds = await prisma.bed.findMany({ where: { wardId: wardA.id }, orderBy: { number: 'asc' } });
  const icuBeds = await prisma.bed.findMany({ where: { wardId: icu.id }, orderBy: { number: 'asc' } });

  // Active admission #1 (General Ward) — occupies a bed.
  await prisma.bed.update({ where: { id: wardABeds[0].id }, data: { status: BedStatus.OCCUPIED } });
  await prisma.admission.create({
    data: { hospitalId, patientProfileId: patients[0].profileId, admittingDoctorId: doctors[0].profileId, bedId: wardABeds[0].id, admissionDate: hoursAgo(20), diagnosis: 'Acute exacerbation — observation', reason: 'Direct admission from OPD', status: AdmissionStatus.ADMITTED },
  });
  // Active admission #2 (ICU) — occupies a bed.
  await prisma.bed.update({ where: { id: icuBeds[0].id }, data: { status: BedStatus.OCCUPIED } });
  await prisma.admission.create({
    data: { hospitalId, patientProfileId: patients[1].profileId, admittingDoctorId: doctors[1 % doctors.length].profileId, bedId: icuBeds[0].id, admissionDate: hoursAgo(10), diagnosis: 'Post-operative ICU monitoring', reason: 'ER-initiated admission', status: AdmissionStatus.ADMITTED },
  });
  // Historical admission with a bed transfer, now discharged (bed freed).
  const histAdm = await prisma.admission.create({
    data: { hospitalId, patientProfileId: patients[2].profileId, admittingDoctorId: doctors[2 % doctors.length].profileId, bedId: wardABeds[2].id, admissionDate: addDays(-5), dischargeDate: addDays(-2), diagnosis: 'Hypertensive crisis — managed', reason: 'Direct admission', status: AdmissionStatus.DISCHARGED, dischargeSummary: 'Stabilized on antihypertensives. Follow-up in clinic in 2 weeks.' },
  });
  await prisma.bedTransfer.create({
    data: { admissionId: histAdm.id, fromBedId: wardABeds[1].id, toBedId: wardABeds[2].id, reason: 'Moved closer to nursing station', transferredAt: addDays(-4), performedById: nurse.id },
  });

  // ── Emergency visits across triage levels & statuses ──
  await prisma.emergencyVisit.createMany({
    data: [
      { hospitalId, displayName: `Unknown ${hIdx % 2 ? 'Female' : 'Male'} ~${30 + (hIdx % 30)}y`, chiefComplaint: 'Unresponsive, found collapsed', arrivedAt: minutesAgo(4), status: EmergencyVisitStatus.ARRIVED },
      { hospitalId, displayName: patients[0].name, nationalPatientId: patients[0].nationalPatientId, patientProfileId: patients[0].profileId, chiefComplaint: 'Severe chest pain radiating to left arm', arrivedAt: minutesAgo(18), triageLevel: TriageLevel.ORANGE, triageNotes: 'BP 160/95, HR 110', triagedById: nurse.id, triagedAt: minutesAgo(12), attendingDoctorId: doctors[0].profileId, claimedAt: minutesAgo(9), status: EmergencyVisitStatus.IN_TREATMENT },
      { hospitalId, displayName: patients[3].name, nationalPatientId: patients[3].nationalPatientId, patientProfileId: patients[3].profileId, chiefComplaint: 'High fever and sore throat', arrivedAt: minutesAgo(40), status: EmergencyVisitStatus.IN_TRIAGE },
      { hospitalId, displayName: patients[4].name, nationalPatientId: patients[4].nationalPatientId, patientProfileId: patients[4].profileId, chiefComplaint: 'Sprained ankle after fall', arrivedAt: minutesAgo(70), triageLevel: TriageLevel.GREEN, triagedById: nurse.id, triagedAt: minutesAgo(60), triageNotes: 'Localized swelling, weight-bearing painful', status: EmergencyVisitStatus.IN_TREATMENT },
      { hospitalId, displayName: patients[5].name, nationalPatientId: patients[5].nationalPatientId, patientProfileId: patients[5].profileId, chiefComplaint: 'Migraine headache', arrivedAt: hoursAgo(5), triageLevel: TriageLevel.YELLOW, triagedById: nurse.id, triagedAt: hoursAgo(4), attendingDoctorId: doctors[1 % doctors.length].profileId, claimedAt: hoursAgo(4), status: EmergencyVisitStatus.DISCHARGED, dispositionNotes: 'Analgesia given, discharged with follow-up.', closedAt: hoursAgo(3) },
    ],
  });

  // ── AI X-ray analyses (mixed statuses, single + ensemble) ──
  const aiReviewer = doctors[0];
  const aiCases: Array<{ prediction: string; probability: number; status: AIAnalysisStatus; ensemble: boolean }> = [
    { prediction: 'PNEUMONIA', probability: 0.92, status: AIAnalysisStatus.APPROVED, ensemble: true },
    { prediction: 'NORMAL', probability: 0.08, status: AIAnalysisStatus.REVIEWED, ensemble: false },
    { prediction: 'PNEUMONIA', probability: 0.74, status: AIAnalysisStatus.PENDING_REVIEW, ensemble: false },
  ];
  for (let i = 0; i < aiCases.length; i++) {
    const c = aiCases[i];
    const pat = patients[(i + 6) % patients.length];
    const threshold = 0.5;
    const riskLevel = c.probability >= 0.85 ? 'HIGH' : c.probability >= 0.6 ? 'ELEVATED' : c.probability >= threshold ? 'MODERATE' : 'LOW';
    const reviewed = c.status !== AIAnalysisStatus.PENDING_REVIEW;
    await prisma.aIAnalysisResult.create({
      data: {
        hospitalId,
        patientProfileId: pat.profileId,
        requestedById: doctors[i % doctors.length].userId,
        reviewedById: reviewed ? aiReviewer.userId : null,
        analysisType: 'PNEUMONIA_XRAY',
        status: c.status,
        prediction: c.prediction,
        probability: c.probability,
        confidence: Math.abs(c.probability - 0.5) * 2,
        threshold,
        riskLevel,
        modelVersion: 'densenet121-v2',
        device: 'cpu',
        analysisMode: c.ensemble ? 'ENSEMBLE' : 'SINGLE_MODEL',
        ensembleMethod: c.ensemble ? 'WEIGHTED_AVERAGE' : null,
        modelAgreement: c.ensemble ? 'STRONG' : null,
        agreementScore: c.ensemble ? 0.94 : null,
        modelResultsJson: c.ensemble
          ? [
              { modelName: 'densenet121', prediction: c.prediction, probability: c.probability, confidence: 0.9 },
              { modelName: 'resnet50', prediction: c.prediction, probability: c.probability - 0.04, confidence: 0.86 },
            ]
          : undefined,
        ensembleWeightsJson: c.ensemble ? { densenet121: 0.6, resnet50: 0.4 } : undefined,
        clinicalNote: c.prediction === 'PNEUMONIA' ? 'Findings suggestive of pneumonic consolidation; correlate clinically.' : 'No acute cardiopulmonary findings.',
        doctorComment: reviewed ? (c.status === AIAnalysisStatus.REJECTED ? 'Disagree with model — likely artefact.' : 'Confirmed; consistent with clinical picture.') : null,
        reviewedAt: reviewed ? hoursAgo(6 + i) : null,
      },
    });
  }

  // ── Notifications ──
  await prisma.notification.createMany({
    data: [
      { userId: doctors[0].userId, hospitalId, type: 'NEW_APPOINTMENT', title: 'New Patient Appointment', message: `New appointment booked with ${patients[0].name}.`, isRead: false },
      { userId: pharmacist.id, hospitalId, type: 'PRESCRIPTION_READY', title: 'Prescriptions to Dispense', message: 'New prescriptions are awaiting dispensing.', isRead: false },
      { userId: labTech.id, hospitalId, type: 'NEW_LAB_ORDER', title: 'New Lab Orders', message: 'Lab orders pending sample collection.', isRead: false },
      { userId: admin.id, hospitalId, type: 'SYSTEM_ALERT', title: 'Low Medication Stock', message: 'Some medications are below reorder level. Please initiate procurement.', isRead: false },
      { userId: nurse.id, hospitalId, type: 'PATIENT_CHECK_IN', title: 'Patient Checked In', message: `${patients[1].name} has checked in.`, isRead: true },
      { userId: reception.id, hospitalId, type: 'NEW_APPOINTMENT', title: 'Walk-in Patient', message: 'A walk-in patient requires scheduling.', isRead: false },
    ],
  });

  // ── Settings ──
  const settings = [
    { key: 'hospital.name', value: spec.name },
    { key: 'hospital.address', value: spec.address },
    { key: 'hospital.phone', value: spec.phone },
    { key: 'hospital.currency', value: 'SYP' },
    { key: 'hospital.taxRate', value: '0.08' },
    { key: 'hospital.appointmentSlotMinutes', value: '30' },
    { key: 'hospital.timezone', value: 'Asia/Damascus' },
    { key: 'hospital.workingHours', value: '08:00-20:00' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { hospitalId_key: { hospitalId, key: s.key } }, update: { value: s.value }, create: { hospitalId, key: s.key, value: s.value } });
  }

  // ── Audit logs ──
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, hospitalId, action: 'CREATE', entity: 'User', entityId: doctors[0].userId, changes: '{"role":"DOCTOR"}', ipAddress: '10.0.0.1' },
      { userId: doctors[0].userId, hospitalId, action: 'CREATE', entity: 'MedicalRecord', changes: '{"diagnosis":"recorded"}', ipAddress: '10.0.0.2' },
      { userId: pharmacist.id, hospitalId, action: 'UPDATE', entity: 'Prescription', changes: '{"status":{"from":"PENDING","to":"DISPENSED"}}', ipAddress: '10.0.0.3' },
      { userId: labTech.id, hospitalId, action: 'UPDATE', entity: 'LabOrder', changes: '{"status":{"from":"IN_PROGRESS","to":"COMPLETED"}}', ipAddress: '10.0.0.4' },
      { userId: reception.id, hospitalId, action: 'CREATE', entity: 'Appointment', changes: '{"type":"CONSULTATION"}', ipAddress: '10.0.0.5' },
    ],
  });

  return { hospitalId, code: spec.code, cityId, cityName: spec.city, doctors, patients };
}

// ════════════════════════════════════════════════════════════════════
//  Cross-governorate referrals (national referral-flow map)
// ════════════════════════════════════════════════════════════════════
async function seedCrossNetworkReferrals(prisma: PrismaClient, results: HospitalResult[]): Promise<void> {
  const existing = await prisma.referral.count();
  if (existing > 10) {
    console.log('    Network referrals already present — skipping.');
    return;
  }
  // Pair hospitals in different cities; vary status & urgency.
  const usable = results.filter((r) => r.doctors.length > 0 && r.patients.length > 0);
  const statuses: Array<{ status: ReferralStatus; urgency: ReferralUrgency }> = [
    { status: ReferralStatus.PENDING, urgency: ReferralUrgency.URGENT },
    { status: ReferralStatus.ACCEPTED, urgency: ReferralUrgency.ROUTINE },
    { status: ReferralStatus.COMPLETED, urgency: ReferralUrgency.URGENT },
    { status: ReferralStatus.PENDING, urgency: ReferralUrgency.EMERGENT },
    { status: ReferralStatus.REJECTED, urgency: ReferralUrgency.ROUTINE },
    { status: ReferralStatus.ACCEPTED, urgency: ReferralUrgency.URGENT },
  ];
  const reasons = [
    { reason: 'Cardiac catheterization unavailable locally', summary: 'Positive stress test, stable angina. Cath suite required.' },
    { reason: 'Neurosurgical evaluation required', summary: 'CT shows mass lesion; needs specialist review.' },
    { reason: 'NICU bed required for premature neonate', summary: '30-week neonate, respiratory distress; needs Level III NICU.' },
    { reason: 'Oncology referral for chemotherapy', summary: 'Newly diagnosed malignancy; requires oncology center.' },
    { reason: 'Complex orthopedic trauma', summary: 'Comminuted fracture; needs specialist fixation.' },
    { reason: 'Burn unit transfer', summary: '25% TBSA burns; requires specialized burn care.' },
  ];

  let made = 0;
  for (let i = 0; i < usable.length && made < 18; i++) {
    const from = usable[i];
    // find a target in a different city
    const to = usable.find((r) => r.cityName !== from.cityName && r !== from && (i + 3) % usable.length === usable.indexOf(r))
      || usable[(i + 5) % usable.length];
    if (!to || to.cityName === from.cityName) continue;

    const plan = pick(statuses, i);
    const rs = pick(reasons, i);
    const pat = from.patients[i % from.patients.length];
    const fromDoc = from.doctors[i % from.doctors.length];
    const toDoc = to.doctors[i % to.doctors.length];
    const accepted = plan.status === ReferralStatus.ACCEPTED || plan.status === ReferralStatus.COMPLETED;
    const responded = plan.status !== ReferralStatus.PENDING;

    await prisma.referral.create({
      data: {
        nationalPatientId: pat.nationalPatientId,
        fromHospitalId: from.hospitalId,
        toHospitalId: to.hospitalId,
        fromDoctorId: fromDoc.profileId,
        toDoctorId: accepted ? toDoc.profileId : null,
        reason: rs.reason,
        clinicalSummary: rs.summary,
        urgency: plan.urgency,
        status: plan.status,
        respondedAt: responded ? hoursAgo(6 + i) : null,
        responseNote: plan.status === ReferralStatus.REJECTED ? 'No capacity at this time.' : accepted ? 'Accepted — arrange transfer.' : null,
        completedAt: plan.status === ReferralStatus.COMPLETED ? hoursAgo(2 + i) : null,
      },
    });

    // For accepted/completed referrals, create a shadow profile at the target
    // hospital so the patient's national record spans both hospitals.
    if (accepted) {
      await prisma.patientProfile.upsert({
        where: { hospitalId_nationalPatientId: { hospitalId: to.hospitalId, nationalPatientId: pat.nationalPatientId } },
        update: {},
        create: { nationalPatientId: pat.nationalPatientId, hospitalId: to.hospitalId, medicalNotes: `Cross-hospital referral from ${from.code}.` },
      });
    }
    made++;
  }
  console.log(`    Created ${made} cross-governorate referrals.`);
}

// ════════════════════════════════════════════════════════════════════
//  Entry point
// ════════════════════════════════════════════════════════════════════
export async function seedNationalNetwork(prisma: PrismaClient, opts: NetworkOptions): Promise<void> {
  const hash = opts.passwordHash;
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Seeding NATIONAL NETWORK (all 14 governorates)…');
  console.log('══════════════════════════════════════════════════════');

  // ── Regional admins for every governorate (idempotent upserts) ──
  const governorates = [
    'Damascus', 'Rural Damascus', 'Aleppo', 'Homs', 'Hama', 'Latakia', 'Tartus',
    'Idlib', 'Daraa', 'As-Suwayda', 'Quneitra', 'Deir ez-Zor', 'Al-Hasakah', 'Raqqa',
  ];
  for (const g of governorates) {
    const city = await prisma.city.findUnique({ where: { name: g }, select: { id: true } });
    if (!city) continue;
    const slug = g.toLowerCase().replace(/[^a-z]/g, '');
    await prisma.user.upsert({
      where: { email: `regional.${slug}@hms.com` },
      update: { role: Role.REGIONAL_ADMIN, hospitalId: null, cityId: city.id },
      create: { email: `regional.${slug}@hms.com`, passwordHash: hash, role: Role.REGIONAL_ADMIN, firstName: g.split(' ')[0], lastName: 'Regional', hospitalId: null, cityId: city.id },
    });
  }
  console.log(`  Ensured ${governorates.length} regional admins (one per governorate).`);

  // ── Hospitals ──
  const cities = await prisma.city.findMany({ select: { id: true, name: true } });
  const cityByName = new Map(cities.map((c) => [c.name, c.id]));

  const results: HospitalResult[] = [];
  let created = 0;
  let populated = 0;
  for (let hIdx = 0; hIdx < HOSPITALS.length; hIdx++) {
    const spec = HOSPITALS[hIdx];
    const cityId = cityByName.get(spec.city);
    if (!cityId) {
      console.log(`  ! Skipping ${spec.code} — city "${spec.city}" not found.`);
      continue;
    }
    const hospital = await prisma.hospital.upsert({
      where: { code: spec.code },
      update: { cityId },
      create: { code: spec.code, name: spec.name, nameAr: spec.nameAr, cityId, address: spec.address, phone: spec.phone },
    });
    created++;

    if (PROTECTED.has(spec.code)) continue;
    const docCount = await prisma.doctorProfile.count({ where: { hospitalId: hospital.id } });
    if (docCount > 0) {
      // already populated in a previous run — still collect refs for referrals
      const docs = await prisma.doctorProfile.findMany({ where: { hospitalId: hospital.id }, select: { id: true, userId: true, departmentId: true, specialization: true } });
      const pats = await prisma.patientProfile.findMany({ where: { hospitalId: hospital.id }, select: { id: true, nationalPatientId: true, userId: true }, take: 12 });
      results.push({
        hospitalId: hospital.id,
        code: spec.code,
        cityId,
        cityName: spec.city,
        doctors: docs.map((d) => ({ profileId: d.id, userId: d.userId, departmentId: d.departmentId, name: '', specialization: d.specialization })),
        patients: pats.map((p) => ({ profileId: p.id, nationalPatientId: p.nationalPatientId, userId: p.userId, name: 'Patient' })),
      });
      continue;
    }

    const res = await populateHospital(prisma, hospital.id, spec, hIdx, hash);
    results.push(res);
    populated++;
    console.log(`  ✓ ${spec.code.padEnd(11)} ${spec.name} — ${spec.city} (${res.doctors.length} doctors, ${res.patients.length} patients)`);
  }

  console.log(`\n  Hospitals ensured: ${created} | newly populated this run: ${populated}`);

  // ── Cross-governorate referrals ──
  console.log('\n  Wiring cross-governorate referrals…');
  await seedCrossNetworkReferrals(prisma, results);

  console.log('\n  National network seed complete.');
}

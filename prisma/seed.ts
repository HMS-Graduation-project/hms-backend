import {
  PrismaClient,
  Role,
  AppointmentStatus,
  PrescriptionStatus,
  LabOrderStatus,
  InvoiceStatus,
  PaymentMethod,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ─── Date Helpers ──────────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);

function daysFromNow(n: number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n: number): Date {
  return daysFromNow(-n);
}

function setTime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// ─── Helper: find-or-create user ───────────────────────────────────
async function upsertUser(
  data: {
    email: string;
    passwordHash: string;
    role: Role;
    firstName: string;
    lastName: string;
    phone?: string;
    gender?: string;
    dateOfBirth?: Date;
    address?: string;
  },
) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      role: data.role,
      firstName: data.firstName,
      lastName: data.lastName,
    },
    create: data,
  });
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN SEED
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log('Starting HMS seed...\n');

  const hash = await bcrypt.hash('password123', 10);
  const adminHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'superadmin123',
    10,
  );

  // ─── 1. Super Admin ──────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'superadmin@example.com' },
    update: { role: Role.SUPER_ADMIN, firstName: 'System', lastName: 'Admin' },
    create: {
      email: process.env.ADMIN_EMAIL || 'superadmin@example.com',
      passwordHash: adminHash,
      role: Role.SUPER_ADMIN,
      firstName: 'System',
      lastName: 'Admin',
    },
  });
  console.log(`  Seeded: ${superAdmin.email} (${superAdmin.role})`);

  // ─── 2. Departments ──────────────────────────────────────────────
  const departmentData = [
    { name: 'Cardiology', description: 'Heart and cardiovascular system', floor: '3', phone: '+90-312-555-0101' },
    { name: 'Neurology', description: 'Brain and nervous system', floor: '4', phone: '+90-312-555-0102' },
    { name: 'Orthopedics', description: 'Bones, joints, and muscles', floor: '2', phone: '+90-312-555-0103' },
    { name: 'Pediatrics', description: 'Children and infant care', floor: '1', phone: '+90-312-555-0104' },
    { name: 'General Surgery', description: 'Surgical procedures', floor: '5', phone: '+90-312-555-0105' },
  ];

  const deptRecords: Record<string, { id: string; name: string }> = {};
  for (const dept of departmentData) {
    const record = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    deptRecords[dept.name] = record;
    console.log(`  Seeded department: ${record.name}`);
  }

  // ─── 3. Staff Users (Admin, Receptionist, Nurse, Pharmacist, Lab Tech) ─
  const adminUser = await upsertUser({
    email: 'admin@hms.com',
    passwordHash: hash,
    role: Role.ADMIN,
    firstName: 'Kemal',
    lastName: 'Atasoy',
    phone: '+90-532-300-0001',
  });
  console.log(`  Seeded: ${adminUser.email} (${adminUser.role})`);

  const receptionistUser = await upsertUser({
    email: 'reception@hms.com',
    passwordHash: hash,
    role: Role.RECEPTIONIST,
    firstName: 'Seda',
    lastName: 'Korkmaz',
    phone: '+90-532-300-0002',
  });
  console.log(`  Seeded: ${receptionistUser.email} (${receptionistUser.role})`);

  const nurseUser = await upsertUser({
    email: 'nurse.aysel@hms.com',
    passwordHash: hash,
    role: Role.NURSE,
    firstName: 'Aysel',
    lastName: 'Dogan',
    phone: '+90-532-300-0003',
    gender: 'Female',
  });
  console.log(`  Seeded: ${nurseUser.email} (${nurseUser.role})`);

  const pharmacistUser = await upsertUser({
    email: 'pharmacist@hms.com',
    passwordHash: hash,
    role: Role.PHARMACIST,
    firstName: 'Emre',
    lastName: 'Bulut',
    phone: '+90-532-300-0004',
    gender: 'Male',
  });
  console.log(`  Seeded: ${pharmacistUser.email} (${pharmacistUser.role})`);

  const labTechUser = await upsertUser({
    email: 'lab.tech@hms.com',
    passwordHash: hash,
    role: Role.LAB_TECHNICIAN,
    firstName: 'Gizem',
    lastName: 'Aksoy',
    phone: '+90-532-300-0005',
    gender: 'Female',
  });
  console.log(`  Seeded: ${labTechUser.email} (${labTechUser.role})`);

  // ─── 4. Doctors (8 total) ────────────────────────────────────────
  const doctorData = [
    // Original 3
    { email: 'dr.ayse@example.com', firstName: 'Ayse', lastName: 'Yilmaz', phone: '+90-532-100-0001', specialization: 'Cardiologist', licenseNumber: 'TR-DOC-10001', department: 'Cardiology', bio: 'Specialist in interventional cardiology with 15 years of experience.', yearsExperience: 15, consultationFee: 250, gender: 'Female' },
    { email: 'dr.mehmet@example.com', firstName: 'Mehmet', lastName: 'Kaya', phone: '+90-532-100-0002', specialization: 'Neurologist', licenseNumber: 'TR-DOC-10002', department: 'Neurology', bio: 'Expert in epilepsy and movement disorders.', yearsExperience: 10, consultationFee: 300, gender: 'Male' },
    { email: 'dr.fatma@example.com', firstName: 'Fatma', lastName: 'Demir', phone: '+90-532-100-0003', specialization: 'Orthopedic Surgeon', licenseNumber: 'TR-DOC-10003', department: 'Orthopedics', bio: 'Sports medicine and joint replacement specialist.', yearsExperience: 12, consultationFee: 275, gender: 'Female' },
    // New 5
    { email: 'dr.ahmet@example.com', firstName: 'Ahmet', lastName: 'Ozturk', phone: '+90-532-100-0004', specialization: 'Pediatrician', licenseNumber: 'TR-DOC-10004', department: 'Pediatrics', bio: 'Pediatric care specialist focused on neonatal and childhood diseases.', yearsExperience: 8, consultationFee: 200, gender: 'Male' },
    { email: 'dr.zeynep@example.com', firstName: 'Zeynep', lastName: 'Cetin', phone: '+90-532-100-0005', specialization: 'General Surgeon', licenseNumber: 'TR-DOC-10005', department: 'General Surgery', bio: 'Laparoscopic and minimally invasive surgery expert.', yearsExperience: 14, consultationFee: 350, gender: 'Female' },
    { email: 'dr.hasan@example.com', firstName: 'Hasan', lastName: 'Sahin', phone: '+90-532-100-0006', specialization: 'Cardiologist', licenseNumber: 'TR-DOC-10006', department: 'Cardiology', bio: 'Electrophysiology and cardiac arrhythmia specialist.', yearsExperience: 18, consultationFee: 320, gender: 'Male' },
    { email: 'dr.elif@example.com', firstName: 'Elif', lastName: 'Yildiz', phone: '+90-532-100-0007', specialization: 'Neurologist', licenseNumber: 'TR-DOC-10007', department: 'Neurology', bio: 'Specializes in neurodegenerative diseases and stroke rehabilitation.', yearsExperience: 9, consultationFee: 280, gender: 'Female' },
    { email: 'dr.murat@example.com', firstName: 'Murat', lastName: 'Erdogan', phone: '+90-532-100-0008', specialization: 'Orthopedic Surgeon', licenseNumber: 'TR-DOC-10008', department: 'Orthopedics', bio: 'Spine surgery and trauma orthopedics specialist.', yearsExperience: 20, consultationFee: 400, gender: 'Male' },
  ];

  interface DoctorRef {
    userId: string;
    profileId: string;
    departmentId: string;
    email: string;
    consultationFee: number;
  }

  const doctorRefs: DoctorRef[] = [];

  for (const doc of doctorData) {
    const user = await upsertUser({
      email: doc.email,
      passwordHash: hash,
      role: Role.DOCTOR,
      firstName: doc.firstName,
      lastName: doc.lastName,
      phone: doc.phone,
      gender: doc.gender,
    });

    const deptId = deptRecords[doc.department].id;

    const profile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: {
        specialization: doc.specialization,
        departmentId: deptId,
      },
      create: {
        userId: user.id,
        specialization: doc.specialization,
        licenseNumber: doc.licenseNumber,
        departmentId: deptId,
        bio: doc.bio,
        yearsExperience: doc.yearsExperience,
        consultationFee: doc.consultationFee,
      },
    });

    doctorRefs.push({
      userId: user.id,
      profileId: profile.id,
      departmentId: deptId,
      email: doc.email,
      consultationFee: doc.consultationFee,
    });
    console.log(`  Seeded doctor: ${doc.firstName} ${doc.lastName} (${doc.specialization})`);
  }

  // ─── 5. Patients (20 total) ──────────────────────────────────────
  const patientData = [
    // Original 5
    { email: 'ali.vural@example.com', firstName: 'Ali', lastName: 'Vural', phone: '+90-533-200-0001', gender: 'Male', bloodType: 'A+', allergies: 'Penicillin', emergencyContactName: 'Zeynep Vural', emergencyContactPhone: '+90-533-200-0010', emergencyContactRelation: 'Spouse', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-001', dateOfBirth: new Date('1985-03-15') },
    { email: 'elif.ozkan@example.com', firstName: 'Elif', lastName: 'Ozkan', phone: '+90-533-200-0002', gender: 'Female', bloodType: 'B+', allergies: null, emergencyContactName: 'Hasan Ozkan', emergencyContactPhone: '+90-533-200-0020', emergencyContactRelation: 'Father', insuranceProvider: 'Anadolu Sigorta', insurancePolicyNumber: 'ANS-2024-042', dateOfBirth: new Date('1992-07-22') },
    { email: 'burak.celik@example.com', firstName: 'Burak', lastName: 'Celik', phone: '+90-533-200-0003', gender: 'Male', bloodType: 'O-', allergies: 'Aspirin, Latex', emergencyContactName: 'Selin Celik', emergencyContactPhone: '+90-533-200-0030', emergencyContactRelation: 'Sister', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-078', dateOfBirth: new Date('1978-11-05') },
    { email: 'deniz.arslan@example.com', firstName: 'Deniz', lastName: 'Arslan', phone: '+90-533-200-0004', gender: 'Female', bloodType: 'AB+', allergies: null, emergencyContactName: 'Murat Arslan', emergencyContactPhone: '+90-533-200-0040', emergencyContactRelation: 'Husband', insuranceProvider: 'Allianz', insurancePolicyNumber: 'ALZ-2024-115', dateOfBirth: new Date('1990-01-30') },
    { email: 'can.yildiz@example.com', firstName: 'Can', lastName: 'Yildiz', phone: '+90-533-200-0005', gender: 'Male', bloodType: 'A-', allergies: 'Sulfa drugs', emergencyContactName: 'Aylin Yildiz', emergencyContactPhone: '+90-533-200-0050', emergencyContactRelation: 'Mother', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-203', dateOfBirth: new Date('2001-06-18') },
    // New 15
    { email: 'selin.kara@example.com', firstName: 'Selin', lastName: 'Kara', phone: '+90-533-200-0006', gender: 'Female', bloodType: 'O+', allergies: null, emergencyContactName: 'Tolga Kara', emergencyContactPhone: '+90-533-200-0060', emergencyContactRelation: 'Spouse', insuranceProvider: 'Mapfre', insurancePolicyNumber: 'MAP-2024-031', dateOfBirth: new Date('1988-04-12') },
    { email: 'emre.tas@example.com', firstName: 'Emre', lastName: 'Tas', phone: '+90-533-200-0007', gender: 'Male', bloodType: 'B-', allergies: 'Ibuprofen', emergencyContactName: 'Sevgi Tas', emergencyContactPhone: '+90-533-200-0070', emergencyContactRelation: 'Mother', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-312', dateOfBirth: new Date('1995-09-08') },
    { email: 'aylin.polat@example.com', firstName: 'Aylin', lastName: 'Polat', phone: '+90-533-200-0008', gender: 'Female', bloodType: 'A+', allergies: null, emergencyContactName: 'Kerem Polat', emergencyContactPhone: '+90-533-200-0080', emergencyContactRelation: 'Brother', insuranceProvider: 'Axa Sigorta', insurancePolicyNumber: 'AXA-2024-088', dateOfBirth: new Date('1983-12-25') },
    { email: 'tolga.kurt@example.com', firstName: 'Tolga', lastName: 'Kurt', phone: '+90-533-200-0009', gender: 'Male', bloodType: 'AB-', allergies: 'Codeine', emergencyContactName: 'Derya Kurt', emergencyContactPhone: '+90-533-200-0090', emergencyContactRelation: 'Spouse', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-445', dateOfBirth: new Date('1975-06-03') },
    { email: 'derya.akin@example.com', firstName: 'Derya', lastName: 'Akin', phone: '+90-533-200-0010', gender: 'Female', bloodType: 'O+', allergies: null, emergencyContactName: 'Mete Akin', emergencyContactPhone: '+90-533-200-0100', emergencyContactRelation: 'Father', insuranceProvider: 'Allianz', insurancePolicyNumber: 'ALZ-2024-220', dateOfBirth: new Date('1998-02-14') },
    { email: 'omer.yalcin@example.com', firstName: 'Omer', lastName: 'Yalcin', phone: '+90-533-200-0011', gender: 'Male', bloodType: 'B+', allergies: 'Erythromycin', emergencyContactName: 'Nur Yalcin', emergencyContactPhone: '+90-533-200-0110', emergencyContactRelation: 'Spouse', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-567', dateOfBirth: new Date('1970-08-20') },
    { email: 'pinar.guler@example.com', firstName: 'Pinar', lastName: 'Guler', phone: '+90-533-200-0012', gender: 'Female', bloodType: 'A-', allergies: null, emergencyContactName: 'Baris Guler', emergencyContactPhone: '+90-533-200-0120', emergencyContactRelation: 'Husband', insuranceProvider: 'Anadolu Sigorta', insurancePolicyNumber: 'ANS-2024-155', dateOfBirth: new Date('1993-11-11') },
    { email: 'serkan.dogan@example.com', firstName: 'Serkan', lastName: 'Dogan', phone: '+90-533-200-0013', gender: 'Male', bloodType: 'O-', allergies: 'Morphine', emergencyContactName: 'Yesim Dogan', emergencyContactPhone: '+90-533-200-0130', emergencyContactRelation: 'Spouse', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-690', dateOfBirth: new Date('1982-05-07') },
    { email: 'yesim.kocer@example.com', firstName: 'Yesim', lastName: 'Kocer', phone: '+90-533-200-0014', gender: 'Female', bloodType: 'AB+', allergies: null, emergencyContactName: 'Cem Kocer', emergencyContactPhone: '+90-533-200-0140', emergencyContactRelation: 'Brother', insuranceProvider: 'Mapfre', insurancePolicyNumber: 'MAP-2024-072', dateOfBirth: new Date('1987-03-28') },
    { email: 'cem.ozdemir@example.com', firstName: 'Cem', lastName: 'Ozdemir', phone: '+90-533-200-0015', gender: 'Male', bloodType: 'A+', allergies: null, emergencyContactName: 'Aysel Ozdemir', emergencyContactPhone: '+90-533-200-0150', emergencyContactRelation: 'Mother', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-801', dateOfBirth: new Date('2000-01-15') },
    { email: 'melis.aydin@example.com', firstName: 'Melis', lastName: 'Aydin', phone: '+90-533-200-0016', gender: 'Female', bloodType: 'B+', allergies: 'Peanuts', emergencyContactName: 'Volkan Aydin', emergencyContactPhone: '+90-533-200-0160', emergencyContactRelation: 'Father', insuranceProvider: 'Axa Sigorta', insurancePolicyNumber: 'AXA-2024-199', dateOfBirth: new Date('1996-10-03') },
    { email: 'volkan.sen@example.com', firstName: 'Volkan', lastName: 'Sen', phone: '+90-533-200-0017', gender: 'Male', bloodType: 'O+', allergies: null, emergencyContactName: 'Esra Sen', emergencyContactPhone: '+90-533-200-0170', emergencyContactRelation: 'Spouse', insuranceProvider: 'Allianz', insurancePolicyNumber: 'ALZ-2024-340', dateOfBirth: new Date('1980-07-19') },
    { email: 'esra.bayrak@example.com', firstName: 'Esra', lastName: 'Bayrak', phone: '+90-533-200-0018', gender: 'Female', bloodType: 'A+', allergies: 'Shellfish', emergencyContactName: 'Hakan Bayrak', emergencyContactPhone: '+90-533-200-0180', emergencyContactRelation: 'Husband', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-920', dateOfBirth: new Date('1991-04-25') },
    { email: 'hakan.turan@example.com', firstName: 'Hakan', lastName: 'Turan', phone: '+90-533-200-0019', gender: 'Male', bloodType: 'B-', allergies: null, emergencyContactName: 'Melis Turan', emergencyContactPhone: '+90-533-200-0190', emergencyContactRelation: 'Sister', insuranceProvider: 'Anadolu Sigorta', insurancePolicyNumber: 'ANS-2024-278', dateOfBirth: new Date('1973-09-12') },
    { email: 'nihan.aksoy@example.com', firstName: 'Nihan', lastName: 'Aksoy', phone: '+90-533-200-0020', gender: 'Female', bloodType: 'O+', allergies: null, emergencyContactName: 'Taner Aksoy', emergencyContactPhone: '+90-533-200-0200', emergencyContactRelation: 'Spouse', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2025-015', dateOfBirth: new Date('1986-12-01') },
  ];

  interface PatientRef {
    userId: string;
    profileId: string;
    email: string;
  }

  const patientRefs: PatientRef[] = [];

  for (const pat of patientData) {
    const user = await upsertUser({
      email: pat.email,
      passwordHash: hash,
      role: Role.PATIENT,
      firstName: pat.firstName,
      lastName: pat.lastName,
      phone: pat.phone,
      gender: pat.gender,
      dateOfBirth: pat.dateOfBirth,
    });

    const profile = await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bloodType: pat.bloodType,
        allergies: pat.allergies,
        emergencyContactName: pat.emergencyContactName,
        emergencyContactPhone: pat.emergencyContactPhone,
        emergencyContactRelation: pat.emergencyContactRelation,
        insuranceProvider: pat.insuranceProvider,
        insurancePolicyNumber: pat.insurancePolicyNumber,
      },
    });

    patientRefs.push({ userId: user.id, profileId: profile.id, email: pat.email });
    console.log(`  Seeded patient: ${pat.firstName} ${pat.lastName}`);
  }

  // ─── 6. Doctor Schedules ─────────────────────────────────────────
  console.log('\n  Seeding doctor schedules...');

  for (let dIdx = 0; dIdx < doctorRefs.length; dIdx++) {
    const doc = doctorRefs[dIdx];
    // Most doctors: Mon-Fri 09:00-17:00
    // Doctor index 5 (dr.hasan): Mon-Sat 09:00-17:00
    // Doctor index 7 (dr.murat): Mon-Fri 13:00-21:00 (afternoon shift)
    let days: number[];
    let startTime: string;
    let endTime: string;
    const slotDuration = 30;

    if (dIdx === 5) {
      // Mon-Sat
      days = [1, 2, 3, 4, 5, 6];
      startTime = '09:00';
      endTime = '17:00';
    } else if (dIdx === 7) {
      // Afternoon shift
      days = [1, 2, 3, 4, 5];
      startTime = '13:00';
      endTime = '21:00';
    } else {
      // Standard Mon-Fri
      days = [1, 2, 3, 4, 5];
      startTime = '09:00';
      endTime = '17:00';
    }

    for (const day of days) {
      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_dayOfWeek: {
            doctorId: doc.profileId,
            dayOfWeek: day,
          },
        },
        update: { startTime, endTime, slotDuration },
        create: {
          doctorId: doc.profileId,
          dayOfWeek: day,
          startTime,
          endTime,
          slotDuration,
        },
      });
    }
    console.log(`    Schedule set for doctor #${dIdx + 1}`);
  }

  // ─── 7. Appointments (50 total) ──────────────────────────────────
  console.log('\n  Seeding appointments...');

  // Delete existing appointments + cascade dependents to make seed idempotent
  // We check if any exist and skip if the exact count is already there
  const existingAppointmentCount = await prisma.appointment.count();
  let appointmentRecords: {
    id: string;
    patientId: string;
    doctorId: string;
    departmentId: string | null;
    status: AppointmentStatus;
    date: Date;
  }[] = [];

  if (existingAppointmentCount >= 50) {
    console.log('    Appointments already seeded, fetching existing...');
    const existing = await prisma.appointment.findMany({
      take: 50,
      orderBy: { createdAt: 'asc' },
    });
    appointmentRecords = existing.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      doctorId: a.doctorId,
      departmentId: a.departmentId,
      status: a.status,
      date: a.date,
    }));
  } else {
    // Clear existing appointments and dependents for a clean seed
    await prisma.payment.deleteMany({});
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.dispensing.deleteMany({});
    await prisma.prescriptionItem.deleteMany({});
    await prisma.prescription.deleteMany({});
    await prisma.labResult.deleteMany({});
    await prisma.labOrder.deleteMany({});
    await prisma.vitalSigns.deleteMany({});
    await prisma.medicalRecord.deleteMany({});
    await prisma.appointment.deleteMany({});

    const appointmentTypes = ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY'];
    const reasons = [
      'Chest pain and shortness of breath',
      'Persistent headache for two weeks',
      'Joint pain and swelling in right knee',
      'Routine cardiac checkup',
      'Follow-up after medication change',
      'Numbness in left arm',
      'Back pain radiating to legs',
      'Dizziness and balance issues',
      'Post-surgery follow-up',
      'Annual physical examination',
      'Abdominal pain and nausea',
      'Skin rash and itching',
      'Difficulty sleeping',
      'Chronic fatigue',
      'Vision problems',
    ];

    const cancelReasons = [
      'Patient requested cancellation due to personal reasons',
      'Scheduling conflict with another appointment',
      'Patient feeling better, no longer needed',
      'Travel emergency',
      'Insurance issue - appointment rescheduled',
    ];

    interface ApptSeed {
      status: AppointmentStatus;
      dateOffset: number; // days from today
      timeSlot: string;
    }

    const appointmentSeeds: ApptSeed[] = [
      // 10 COMPLETED (past)
      ...Array.from({ length: 10 }, (_, i) => ({
        status: AppointmentStatus.COMPLETED,
        dateOffset: -(i + 3),
        timeSlot: `${9 + (i % 7)}:${i % 2 === 0 ? '00' : '30'}`,
      })),
      // 10 CONFIRMED (upcoming)
      ...Array.from({ length: 10 }, (_, i) => ({
        status: AppointmentStatus.CONFIRMED,
        dateOffset: i + 2,
        timeSlot: `${9 + (i % 7)}:${i % 2 === 0 ? '00' : '30'}`,
      })),
      // 15 PENDING (upcoming)
      ...Array.from({ length: 15 }, (_, i) => ({
        status: AppointmentStatus.PENDING,
        dateOffset: i + 3,
        timeSlot: `${10 + (i % 6)}:${i % 2 === 0 ? '00' : '30'}`,
      })),
      // 5 IN_PROGRESS (today)
      ...Array.from({ length: 5 }, (_, i) => ({
        status: AppointmentStatus.IN_PROGRESS,
        dateOffset: 0,
        timeSlot: `${9 + i}:00`,
      })),
      // 5 CANCELLED (past)
      ...Array.from({ length: 5 }, (_, i) => ({
        status: AppointmentStatus.CANCELLED,
        dateOffset: -(i + 1),
        timeSlot: `${11 + i}:00`,
      })),
      // 5 NO_SHOW (past)
      ...Array.from({ length: 5 }, (_, i) => ({
        status: AppointmentStatus.NO_SHOW,
        dateOffset: -(i + 2),
        timeSlot: `${14 + (i % 4)}:00`,
      })),
    ];

    for (let i = 0; i < appointmentSeeds.length; i++) {
      const seed = appointmentSeeds[i];
      const patRef = patientRefs[i % patientRefs.length];
      const docRef = doctorRefs[i % doctorRefs.length];
      const apptDate = daysFromNow(seed.dateOffset);
      const [h, m] = seed.timeSlot.split(':').map(Number);
      const startHour = h;
      const startMin = m;
      const endMin = startMin + 30;
      const endHour = startHour + Math.floor(endMin / 60);
      const endMinFinal = endMin % 60;

      const record = await prisma.appointment.create({
        data: {
          patientId: patRef.profileId,
          doctorId: docRef.profileId,
          departmentId: docRef.departmentId,
          date: apptDate,
          startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
          endTime: `${String(endHour).padStart(2, '0')}:${String(endMinFinal).padStart(2, '0')}`,
          status: seed.status,
          type: appointmentTypes[i % appointmentTypes.length],
          reason: reasons[i % reasons.length],
          notes: seed.status === AppointmentStatus.COMPLETED ? 'Patient visit completed successfully.' : null,
          cancelReason: seed.status === AppointmentStatus.CANCELLED ? cancelReasons[i % cancelReasons.length] : null,
        },
      });

      appointmentRecords.push({
        id: record.id,
        patientId: record.patientId,
        doctorId: record.doctorId,
        departmentId: record.departmentId,
        status: record.status,
        date: record.date,
      });
    }
    console.log(`    Created ${appointmentRecords.length} appointments`);
  }

  // ─── 8. Medical Records (15 for completed appointments) ──────────
  console.log('\n  Seeding medical records...');

  const completedAppointments = appointmentRecords.filter(
    (a) => a.status === AppointmentStatus.COMPLETED,
  );

  const medicalRecordData = [
    { chiefComplaint: 'Chest pain', presentIllness: 'Patient reports intermittent chest pain for the past 3 days, worsening with exertion.', examination: 'Heart sounds normal, no murmurs. ECG shows normal sinus rhythm.', diagnosis: 'Hypertension', icdCodes: 'I10', treatmentPlan: 'Start Amlodipine 5mg daily. Lifestyle modifications advised. Follow-up in 2 weeks.' },
    { chiefComplaint: 'Persistent headache', presentIllness: 'Severe headaches occurring 3-4 times per week for the past month, associated with nausea and photophobia.', examination: 'Neurological examination normal. Fundoscopy unremarkable.', diagnosis: 'Migraine without aura', icdCodes: 'G43.0', treatmentPlan: 'Prescribe Sumatriptan for acute episodes. Start prophylactic Topiramate 25mg. Headache diary recommended.' },
    { chiefComplaint: 'Joint pain and swelling', presentIllness: 'Right knee pain and swelling for 2 weeks, difficulty walking and climbing stairs.', examination: 'Right knee: moderate effusion, limited ROM. McMurray test negative.', diagnosis: 'Osteoarthritis of knee', icdCodes: 'M17.1', treatmentPlan: 'NSAIDs for pain management. Physical therapy referral. Consider intra-articular injection if no improvement.' },
    { chiefComplaint: 'Shortness of breath', presentIllness: 'Progressive dyspnea on exertion over past 2 months. No orthopnea or PND.', examination: 'Bilateral basal crackles. JVP not elevated. SpO2 94% on room air.', diagnosis: 'Congestive heart failure - mild', icdCodes: 'I50.9', treatmentPlan: 'Start Furosemide 20mg daily. Echocardiography ordered. Low-sodium diet counseling.' },
    { chiefComplaint: 'Numbness in extremities', presentIllness: 'Tingling and numbness in both feet for 3 months, progressive. History of diabetes mellitus.', examination: 'Decreased sensation to light touch in stocking distribution. Ankle reflexes diminished.', diagnosis: 'Diabetic peripheral neuropathy', icdCodes: 'G63.2', treatmentPlan: 'Optimize glycemic control. Start Pregabalin 75mg twice daily. Refer to diabetes educator.' },
    { chiefComplaint: 'Back pain', presentIllness: 'Lower back pain radiating to left leg for 1 week after lifting heavy furniture.', examination: 'Positive straight leg raise at 45 degrees on left. L4-L5 tenderness.', diagnosis: 'Lumbar disc herniation', icdCodes: 'M51.1', treatmentPlan: 'Conservative management with NSAIDs and muscle relaxants. Physical therapy. MRI lumbar spine ordered.' },
    { chiefComplaint: 'Dizziness', presentIllness: 'Episodes of room-spinning vertigo lasting 30 seconds, triggered by head position changes.', examination: 'Positive Dix-Hallpike test on right side. No nystagmus at rest.', diagnosis: 'Benign paroxysmal positional vertigo', icdCodes: 'H81.1', treatmentPlan: 'Epley maneuver performed in clinic. Home exercises prescribed. Follow-up in 1 week.' },
    { chiefComplaint: 'Abdominal pain', presentIllness: 'Epigastric pain after meals for 4 weeks. Associated with bloating and heartburn.', examination: 'Abdomen soft, mild epigastric tenderness. No guarding or rigidity.', diagnosis: 'Gastroesophageal reflux disease', icdCodes: 'K21.0', treatmentPlan: 'Start Omeprazole 20mg before breakfast. Dietary modifications. Avoid late-night meals.' },
    { chiefComplaint: 'Chronic fatigue', presentIllness: 'Persistent fatigue and lethargy for 2 months. Weight gain of 5kg. Cold intolerance.', examination: 'Thyroid: diffusely enlarged, non-tender. Skin dry. Reflexes delayed.', diagnosis: 'Hypothyroidism', icdCodes: 'E03.9', treatmentPlan: 'Start Levothyroxine 50mcg daily. Thyroid function tests in 6 weeks. Nutritional counseling.' },
    { chiefComplaint: 'Recurrent fever', presentIllness: 'Low-grade fever (37.5-38.2C) recurring over past 10 days. Sore throat and malaise.', examination: 'Pharynx erythematous. Bilateral cervical lymphadenopathy. Tonsils enlarged.', diagnosis: 'Acute tonsillopharyngitis', icdCodes: 'J03.9', treatmentPlan: 'Amoxicillin 500mg three times daily for 7 days. Rest and fluids. Paracetamol for fever.' },
    { chiefComplaint: 'Skin rash', presentIllness: 'Itchy red patches on forearms and trunk for 3 weeks. No known triggers.', examination: 'Erythematous, scaly plaques on bilateral forearms and anterior trunk. No vesicles.', diagnosis: 'Contact dermatitis', icdCodes: 'L25.9', treatmentPlan: 'Topical corticosteroid cream. Oral antihistamine at night. Identify and avoid irritant.' },
    { chiefComplaint: 'Palpitations', presentIllness: 'Intermittent palpitations for 2 weeks, lasting 5-10 minutes. No syncope or chest pain.', examination: 'Irregular pulse at 92 bpm. Heart sounds normal. No peripheral edema.', diagnosis: 'Atrial fibrillation - paroxysmal', icdCodes: 'I48.0', treatmentPlan: 'Start Metoprolol 25mg twice daily. 24-hour Holter monitor ordered. Anticoagulation assessment.' },
    { chiefComplaint: 'Difficulty sleeping', presentIllness: 'Insomnia for past 6 weeks. Takes 2+ hours to fall asleep. Daytime drowsiness.', examination: 'Alert but fatigued appearance. Mental status examination normal. BMI 28.', diagnosis: 'Primary insomnia', icdCodes: 'G47.0', treatmentPlan: 'Sleep hygiene counseling. Cognitive behavioral therapy referral. Short-term Melatonin 3mg.' },
    { chiefComplaint: 'Cough with sputum', presentIllness: 'Productive cough with yellowish sputum for 5 days. Low-grade fever. No hemoptysis.', examination: 'Right lower lobe crackles on auscultation. SpO2 96%. Temperature 37.8C.', diagnosis: 'Community-acquired pneumonia', icdCodes: 'J18.9', treatmentPlan: 'Amoxicillin-clavulanate 625mg three times daily for 7 days. Chest X-ray ordered. Rest and hydration.' },
    { chiefComplaint: 'Frequent urination', presentIllness: 'Polyuria and polydipsia for 3 weeks. Unintentional weight loss of 4kg.', examination: 'Mild dehydration. BMI 32. Acanthosis nigricans in axillae.', diagnosis: 'Type 2 Diabetes Mellitus', icdCodes: 'E11.9', treatmentPlan: 'Start Metformin 500mg twice daily. Diabetic diet plan. HbA1c and fasting glucose monitoring. Diabetes education.' },
  ];

  interface MedRecordRef {
    id: string;
    appointmentId: string;
    patientId: string;
    doctorId: string;
  }

  const medRecordRefs: MedRecordRef[] = [];

  const existingMedRecordCount = await prisma.medicalRecord.count();
  if (existingMedRecordCount >= 15) {
    console.log('    Medical records already seeded, fetching existing...');
    const existing = await prisma.medicalRecord.findMany({ take: 15, orderBy: { createdAt: 'asc' } });
    for (const r of existing) {
      medRecordRefs.push({ id: r.id, appointmentId: r.appointmentId, patientId: r.patientId, doctorId: r.doctorId });
    }
  } else {
    for (let i = 0; i < Math.min(15, completedAppointments.length); i++) {
      const appt = completedAppointments[i];
      const data = medicalRecordData[i % medicalRecordData.length];

      // Check if medical record already exists for this appointment
      const existingRecord = await prisma.medicalRecord.findUnique({
        where: { appointmentId: appt.id },
      });

      if (existingRecord) {
        medRecordRefs.push({
          id: existingRecord.id,
          appointmentId: existingRecord.appointmentId,
          patientId: existingRecord.patientId,
          doctorId: existingRecord.doctorId,
        });
        continue;
      }

      const record = await prisma.medicalRecord.create({
        data: {
          appointmentId: appt.id,
          patientId: appt.patientId,
          doctorId: appt.doctorId,
          chiefComplaint: data.chiefComplaint,
          presentIllness: data.presentIllness,
          examination: data.examination,
          diagnosis: data.diagnosis,
          icdCodes: data.icdCodes,
          treatmentPlan: data.treatmentPlan,
          notes: 'Patient education provided. Return if symptoms worsen.',
        },
      });

      medRecordRefs.push({
        id: record.id,
        appointmentId: record.appointmentId,
        patientId: record.patientId,
        doctorId: record.doctorId,
      });
    }
    console.log(`    Created ${medRecordRefs.length} medical records`);
  }

  // ─── 9. Vital Signs (10 records) ────────────────────────────────
  console.log('\n  Seeding vital signs...');

  const vitalSignsData = [
    { temperature: 36.6, bpSystolic: 120, bpDiastolic: 80, heartRate: 72, respiratoryRate: 16, oxygenSaturation: 98, weight: 75.0, height: 175.0 },
    { temperature: 37.2, bpSystolic: 140, bpDiastolic: 90, heartRate: 88, respiratoryRate: 18, oxygenSaturation: 97, weight: 68.0, height: 162.0 },
    { temperature: 36.8, bpSystolic: 118, bpDiastolic: 76, heartRate: 65, respiratoryRate: 14, oxygenSaturation: 99, weight: 82.0, height: 180.0 },
    { temperature: 37.5, bpSystolic: 135, bpDiastolic: 85, heartRate: 92, respiratoryRate: 20, oxygenSaturation: 94, weight: 90.0, height: 170.0 },
    { temperature: 36.5, bpSystolic: 110, bpDiastolic: 70, heartRate: 60, respiratoryRate: 15, oxygenSaturation: 98, weight: 55.0, height: 158.0 },
    { temperature: 38.1, bpSystolic: 125, bpDiastolic: 82, heartRate: 98, respiratoryRate: 22, oxygenSaturation: 96, weight: 77.0, height: 172.0 },
    { temperature: 36.9, bpSystolic: 130, bpDiastolic: 88, heartRate: 78, respiratoryRate: 16, oxygenSaturation: 97, weight: 85.0, height: 178.0 },
    { temperature: 37.0, bpSystolic: 115, bpDiastolic: 75, heartRate: 70, respiratoryRate: 15, oxygenSaturation: 99, weight: 63.0, height: 165.0 },
    { temperature: 38.5, bpSystolic: 138, bpDiastolic: 86, heartRate: 100, respiratoryRate: 24, oxygenSaturation: 95, weight: 72.0, height: 168.0 },
    { temperature: 36.7, bpSystolic: 122, bpDiastolic: 78, heartRate: 74, respiratoryRate: 17, oxygenSaturation: 98, weight: 95.0, height: 182.0 },
  ];

  for (let i = 0; i < Math.min(10, medRecordRefs.length); i++) {
    const mr = medRecordRefs[i];
    const vs = vitalSignsData[i];

    const existingVs = await prisma.vitalSigns.findUnique({
      where: { medicalRecordId: mr.id },
    });
    if (existingVs) continue;

    await prisma.vitalSigns.create({
      data: {
        medicalRecordId: mr.id,
        temperature: vs.temperature,
        bloodPressureSystolic: vs.bpSystolic,
        bloodPressureDiastolic: vs.bpDiastolic,
        heartRate: vs.heartRate,
        respiratoryRate: vs.respiratoryRate,
        oxygenSaturation: vs.oxygenSaturation,
        weight: vs.weight,
        height: vs.height,
      },
    });
  }
  console.log('    Vital signs seeded');

  // ─── 10. Prescriptions (10, with 2-3 items each) ────────────────
  console.log('\n  Seeding prescriptions...');

  const prescriptionConfigs = [
    {
      status: PrescriptionStatus.DISPENSED,
      notes: 'Take with meals. Avoid alcohol.',
      items: [
        { medicationName: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily', duration: '30 days', quantity: 30, instructions: 'Take in the morning with water' },
        { medicationName: 'Aspirin 100mg', dosage: '100mg', frequency: 'Once daily', duration: '90 days', quantity: 90, instructions: 'Take after dinner' },
      ],
    },
    {
      status: PrescriptionStatus.DISPENSED,
      notes: 'Monitor for side effects. Follow up in 2 weeks.',
      items: [
        { medicationName: 'Sumatriptan 50mg', dosage: '50mg', frequency: 'As needed', duration: '30 days', quantity: 9, instructions: 'Take at onset of migraine. Max 2 tablets per day.' },
        { medicationName: 'Topiramate 25mg', dosage: '25mg', frequency: 'Once daily', duration: '60 days', quantity: 60, instructions: 'Take at bedtime. Increase to 50mg after 2 weeks if tolerated.' },
        { medicationName: 'Paracetamol 500mg', dosage: '1000mg', frequency: 'Every 6 hours as needed', duration: '14 days', quantity: 56, instructions: 'Maximum 4 doses per day' },
      ],
    },
    {
      status: PrescriptionStatus.PENDING,
      notes: 'Physical therapy recommended alongside medication.',
      items: [
        { medicationName: 'Ibuprofen 400mg', dosage: '400mg', frequency: 'Three times daily', duration: '14 days', quantity: 42, instructions: 'Take with food. Avoid on empty stomach.' },
        { medicationName: 'Omeprazole 20mg', dosage: '20mg', frequency: 'Once daily', duration: '14 days', quantity: 14, instructions: 'Take 30 minutes before breakfast for gastric protection' },
      ],
    },
    {
      status: PrescriptionStatus.DISPENSED,
      notes: 'Strict fluid intake monitoring advised.',
      items: [
        { medicationName: 'Furosemide 20mg', dosage: '20mg', frequency: 'Once daily', duration: '30 days', quantity: 30, instructions: 'Take in the morning. Monitor weight daily.' },
        { medicationName: 'Losartan 50mg', dosage: '50mg', frequency: 'Once daily', duration: '30 days', quantity: 30, instructions: 'Take at the same time each day' },
      ],
    },
    {
      status: PrescriptionStatus.PENDING,
      notes: 'Optimize blood glucose alongside neuropathy treatment.',
      items: [
        { medicationName: 'Pregabalin 75mg', dosage: '75mg', frequency: 'Twice daily', duration: '30 days', quantity: 60, instructions: 'Take morning and evening. Do not stop abruptly.' },
        { medicationName: 'Metformin 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '90 days', quantity: 180, instructions: 'Take with meals to reduce GI side effects' },
        { medicationName: 'Vitamin B12 1000mcg', dosage: '1000mcg', frequency: 'Once daily', duration: '60 days', quantity: 60, instructions: 'Take with breakfast' },
      ],
    },
    {
      status: PrescriptionStatus.PARTIALLY_DISPENSED,
      notes: 'Patient to return for physical therapy evaluation.',
      items: [
        { medicationName: 'Naproxen 500mg', dosage: '500mg', frequency: 'Twice daily', duration: '10 days', quantity: 20, instructions: 'Take with food' },
        { medicationName: 'Cyclobenzaprine 10mg', dosage: '10mg', frequency: 'At bedtime', duration: '7 days', quantity: 7, instructions: 'May cause drowsiness. Do not drive.' },
      ],
    },
    {
      status: PrescriptionStatus.DISPENSED,
      notes: 'Home exercises and position changes advised.',
      items: [
        { medicationName: 'Betahistine 16mg', dosage: '16mg', frequency: 'Three times daily', duration: '14 days', quantity: 42, instructions: 'Take with meals' },
        { medicationName: 'Dimenhydrinate 50mg', dosage: '50mg', frequency: 'As needed', duration: '7 days', quantity: 14, instructions: 'Take for acute vertigo episodes. May cause drowsiness.' },
      ],
    },
    {
      status: PrescriptionStatus.PENDING,
      notes: 'Avoid spicy and acidic foods.',
      items: [
        { medicationName: 'Omeprazole 20mg', dosage: '20mg', frequency: 'Once daily', duration: '28 days', quantity: 28, instructions: 'Take 30 minutes before breakfast' },
        { medicationName: 'Domperidone 10mg', dosage: '10mg', frequency: 'Three times daily', duration: '14 days', quantity: 42, instructions: 'Take 15-30 minutes before meals' },
      ],
    },
    {
      status: PrescriptionStatus.DISPENSED,
      notes: 'Thyroid function recheck in 6 weeks.',
      items: [
        { medicationName: 'Levothyroxine 50mcg', dosage: '50mcg', frequency: 'Once daily', duration: '90 days', quantity: 90, instructions: 'Take on empty stomach, 30 min before breakfast. Avoid calcium/iron within 4 hours.' },
      ],
    },
    {
      status: PrescriptionStatus.DISPENSED,
      notes: 'Complete full course of antibiotics.',
      items: [
        { medicationName: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'Three times daily', duration: '7 days', quantity: 21, instructions: 'Take at evenly spaced intervals. Complete full course.' },
        { medicationName: 'Paracetamol 500mg', dosage: '1000mg', frequency: 'Every 6 hours as needed', duration: '5 days', quantity: 20, instructions: 'For fever and pain. Max 4g per day.' },
        { medicationName: 'Chlorhexidine Mouthwash', dosage: '15ml', frequency: 'Twice daily', duration: '7 days', quantity: 1, instructions: 'Gargle for 30 seconds after brushing teeth' },
      ],
    },
  ];

  interface PrescriptionRef {
    id: string;
    status: PrescriptionStatus;
    medicalRecordId: string;
  }

  const prescriptionRefs: PrescriptionRef[] = [];

  const existingPrescriptionCount = await prisma.prescription.count();
  if (existingPrescriptionCount >= 10) {
    console.log('    Prescriptions already seeded');
    const existing = await prisma.prescription.findMany({ take: 10, orderBy: { createdAt: 'asc' } });
    for (const p of existing) {
      prescriptionRefs.push({ id: p.id, status: p.status, medicalRecordId: p.medicalRecordId });
    }
  } else {
    for (let i = 0; i < Math.min(10, medRecordRefs.length); i++) {
      const mr = medRecordRefs[i];
      const config = prescriptionConfigs[i];

      const prescription = await prisma.prescription.create({
        data: {
          medicalRecordId: mr.id,
          patientId: mr.patientId,
          doctorId: mr.doctorId,
          status: config.status,
          notes: config.notes,
          items: {
            create: config.items.map((item) => ({
              medicationName: item.medicationName,
              dosage: item.dosage,
              frequency: item.frequency,
              duration: item.duration,
              quantity: item.quantity,
              instructions: item.instructions,
            })),
          },
        },
      });

      prescriptionRefs.push({ id: prescription.id, status: prescription.status, medicalRecordId: prescription.medicalRecordId });
    }
    console.log(`    Created ${prescriptionRefs.length} prescriptions`);
  }

  // ─── 11. Lab Orders (20, mix of statuses) ────────────────────────
  console.log('\n  Seeding lab orders...');

  const labTestConfigs = [
    // 5 COMPLETED with results
    { testName: 'Complete Blood Count', testCategory: 'Hematology', status: LabOrderStatus.COMPLETED, priority: 'NORMAL', result: { result: 'WBC: 7.2, RBC: 4.8, Hgb: 14.5, Hct: 43%, Plt: 250', normalRange: 'WBC: 4-11, RBC: 4.5-5.5, Hgb: 12-16, Hct: 36-48%, Plt: 150-400', unit: 'x10^3/uL, x10^6/uL, g/dL, %, x10^3/uL', isAbnormal: false } },
    { testName: 'Blood Glucose (Fasting)', testCategory: 'Biochemistry', status: LabOrderStatus.COMPLETED, priority: 'URGENT', result: { result: '142 mg/dL', normalRange: '70-100 mg/dL', unit: 'mg/dL', isAbnormal: true } },
    { testName: 'Lipid Panel', testCategory: 'Biochemistry', status: LabOrderStatus.COMPLETED, priority: 'NORMAL', result: { result: 'Total Cholesterol: 220, LDL: 145, HDL: 42, Triglycerides: 165', normalRange: 'TC: <200, LDL: <100, HDL: >40, TG: <150', unit: 'mg/dL', isAbnormal: true } },
    { testName: 'Thyroid Panel (TSH, T3, T4)', testCategory: 'Endocrinology', status: LabOrderStatus.COMPLETED, priority: 'NORMAL', result: { result: 'TSH: 8.5, Free T4: 0.7, Free T3: 2.1', normalRange: 'TSH: 0.4-4.0, FT4: 0.8-1.8, FT3: 2.3-4.2', unit: 'mIU/L, ng/dL, pg/mL', isAbnormal: true } },
    { testName: 'Liver Function Tests', testCategory: 'Biochemistry', status: LabOrderStatus.COMPLETED, priority: 'NORMAL', result: { result: 'ALT: 28, AST: 25, ALP: 72, Bilirubin: 0.9, Albumin: 4.2', normalRange: 'ALT: 7-56, AST: 10-40, ALP: 44-147, Bili: 0.1-1.2, Alb: 3.5-5.0', unit: 'U/L, U/L, U/L, mg/dL, g/dL', isAbnormal: false } },
    // 5 IN_PROGRESS
    { testName: 'Urinalysis', testCategory: 'Pathology', status: LabOrderStatus.IN_PROGRESS, priority: 'NORMAL', result: null },
    { testName: 'HbA1c', testCategory: 'Biochemistry', status: LabOrderStatus.IN_PROGRESS, priority: 'URGENT', result: null },
    { testName: 'Renal Function Panel', testCategory: 'Biochemistry', status: LabOrderStatus.IN_PROGRESS, priority: 'NORMAL', result: null },
    { testName: 'Coagulation Profile', testCategory: 'Hematology', status: LabOrderStatus.IN_PROGRESS, priority: 'URGENT', result: null },
    { testName: 'C-Reactive Protein', testCategory: 'Immunology', status: LabOrderStatus.IN_PROGRESS, priority: 'NORMAL', result: null },
    // 5 ORDERED
    { testName: 'Vitamin D Level', testCategory: 'Biochemistry', status: LabOrderStatus.ORDERED, priority: 'NORMAL', result: null },
    { testName: 'Iron Studies', testCategory: 'Hematology', status: LabOrderStatus.ORDERED, priority: 'NORMAL', result: null },
    { testName: 'Electrolyte Panel', testCategory: 'Biochemistry', status: LabOrderStatus.ORDERED, priority: 'URGENT', result: null },
    { testName: 'Blood Culture', testCategory: 'Microbiology', status: LabOrderStatus.ORDERED, priority: 'STAT', result: null },
    { testName: 'Chest X-Ray Report', testCategory: 'Radiology', status: LabOrderStatus.ORDERED, priority: 'NORMAL', result: null },
    // 5 SAMPLE_COLLECTED
    { testName: 'Urine Culture', testCategory: 'Microbiology', status: LabOrderStatus.SAMPLE_COLLECTED, priority: 'NORMAL', result: null },
    { testName: 'ESR (Sedimentation Rate)', testCategory: 'Hematology', status: LabOrderStatus.SAMPLE_COLLECTED, priority: 'NORMAL', result: null },
    { testName: 'Cardiac Enzymes (Troponin)', testCategory: 'Biochemistry', status: LabOrderStatus.SAMPLE_COLLECTED, priority: 'STAT', result: null },
    { testName: 'Serum Calcium', testCategory: 'Biochemistry', status: LabOrderStatus.SAMPLE_COLLECTED, priority: 'NORMAL', result: null },
    { testName: 'Prothrombin Time (PT/INR)', testCategory: 'Hematology', status: LabOrderStatus.SAMPLE_COLLECTED, priority: 'URGENT', result: null },
  ];

  const existingLabCount = await prisma.labOrder.count();
  if (existingLabCount >= 20) {
    console.log('    Lab orders already seeded');
  } else {
    for (let i = 0; i < labTestConfigs.length; i++) {
      const config = labTestConfigs[i];
      // Distribute across medical records where possible, else use first available
      const mrIdx = i % medRecordRefs.length;
      const mr = medRecordRefs[mrIdx];

      const labOrder = await prisma.labOrder.create({
        data: {
          medicalRecordId: mr.id,
          patientId: mr.patientId,
          doctorId: mr.doctorId,
          testName: config.testName,
          testCategory: config.testCategory,
          status: config.status,
          priority: config.priority,
          notes: config.status === LabOrderStatus.COMPLETED ? 'Results reviewed by ordering physician.' : null,
          completedAt: config.status === LabOrderStatus.COMPLETED ? daysAgo(1) : null,
        },
      });

      // Create results for COMPLETED orders
      if (config.result) {
        await prisma.labResult.create({
          data: {
            labOrderId: labOrder.id,
            result: config.result.result,
            normalRange: config.result.normalRange,
            unit: config.result.unit,
            isAbnormal: config.result.isAbnormal,
            technicianId: labTechUser.id,
            notes: config.result.isAbnormal ? 'Abnormal result - physician notified.' : 'All values within normal range.',
          },
        });
      }
    }
    console.log('    Created 20 lab orders (5 with results)');
  }

  // ─── 12. Medications Inventory (15 items) ────────────────────────
  console.log('\n  Seeding medications inventory...');

  const medicationData = [
    { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotic', manufacturer: 'Bilim Ilac', dosageForm: 'Capsule', strength: '500mg', unit: 'capsule', price: 12.50, stock: 500, reorderLevel: 50, expiryDate: daysFromNow(365) },
    { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'NSAID', manufacturer: 'Abdi Ibrahim', dosageForm: 'Tablet', strength: '400mg', unit: 'tablet', price: 8.75, stock: 800, reorderLevel: 100, expiryDate: daysFromNow(540) },
    { name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Proton Pump Inhibitor', manufacturer: 'Nobel Ilac', dosageForm: 'Capsule', strength: '20mg', unit: 'capsule', price: 15.00, stock: 400, reorderLevel: 40, expiryDate: daysFromNow(450) },
    { name: 'Metformin 500mg', genericName: 'Metformin HCl', category: 'Antidiabetic', manufacturer: 'Eczacibasi', dosageForm: 'Tablet', strength: '500mg', unit: 'tablet', price: 6.25, stock: 1200, reorderLevel: 120, expiryDate: daysFromNow(730) },
    { name: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', category: 'Calcium Channel Blocker', manufacturer: 'Abdi Ibrahim', dosageForm: 'Tablet', strength: '5mg', unit: 'tablet', price: 10.00, stock: 600, reorderLevel: 60, expiryDate: daysFromNow(500) },
    { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic', manufacturer: 'Bilim Ilac', dosageForm: 'Tablet', strength: '500mg', unit: 'tablet', price: 4.50, stock: 2000, reorderLevel: 200, expiryDate: daysFromNow(400) },
    { name: 'Aspirin 100mg', genericName: 'Acetylsalicylic Acid', category: 'Antiplatelet', manufacturer: 'Bayer', dosageForm: 'Tablet', strength: '100mg', unit: 'tablet', price: 5.00, stock: 1000, reorderLevel: 100, expiryDate: daysFromNow(600) },
    { name: 'Ciprofloxacin 500mg', genericName: 'Ciprofloxacin HCl', category: 'Antibiotic', manufacturer: 'Nobel Ilac', dosageForm: 'Tablet', strength: '500mg', unit: 'tablet', price: 18.50, stock: 300, reorderLevel: 30, expiryDate: daysFromNow(365) },
    { name: 'Losartan 50mg', genericName: 'Losartan Potassium', category: 'ARB', manufacturer: 'Eczacibasi', dosageForm: 'Tablet', strength: '50mg', unit: 'tablet', price: 14.00, stock: 450, reorderLevel: 45, expiryDate: daysFromNow(480) },
    { name: 'Atorvastatin 20mg', genericName: 'Atorvastatin Calcium', category: 'Statin', manufacturer: 'Abdi Ibrahim', dosageForm: 'Tablet', strength: '20mg', unit: 'tablet', price: 22.00, stock: 350, reorderLevel: 35, expiryDate: daysFromNow(550) },
    { name: 'Levothyroxine 50mcg', genericName: 'Levothyroxine Sodium', category: 'Thyroid Hormone', manufacturer: 'Merck', dosageForm: 'Tablet', strength: '50mcg', unit: 'tablet', price: 9.50, stock: 700, reorderLevel: 70, expiryDate: daysFromNow(420) },
    { name: 'Pregabalin 75mg', genericName: 'Pregabalin', category: 'Anticonvulsant', manufacturer: 'Pfizer', dosageForm: 'Capsule', strength: '75mg', unit: 'capsule', price: 28.00, stock: 200, reorderLevel: 20, expiryDate: daysFromNow(380) },
    { name: 'Furosemide 20mg', genericName: 'Furosemide', category: 'Diuretic', manufacturer: 'Bilim Ilac', dosageForm: 'Tablet', strength: '20mg', unit: 'tablet', price: 7.00, stock: 550, reorderLevel: 55, expiryDate: daysFromNow(460) },
    { name: 'Metoprolol 25mg', genericName: 'Metoprolol Tartrate', category: 'Beta Blocker', manufacturer: 'Nobel Ilac', dosageForm: 'Tablet', strength: '25mg', unit: 'tablet', price: 11.50, stock: 480, reorderLevel: 48, expiryDate: daysFromNow(520) },
    { name: 'Diazepam 5mg', genericName: 'Diazepam', category: 'Benzodiazepine', manufacturer: 'Roche', dosageForm: 'Tablet', strength: '5mg', unit: 'tablet', price: 16.00, stock: 150, reorderLevel: 15, expiryDate: daysFromNow(300) },
  ];

  for (const med of medicationData) {
    // Use name as a pseudo-unique key (no unique constraint in schema, so find first)
    const existing = await prisma.medication.findFirst({ where: { name: med.name } });
    if (!existing) {
      await prisma.medication.create({ data: med });
    }
  }
  console.log('    Seeded 15 medications');

  // ─── 13. Invoices (10, mix of statuses) with line items ──────────
  console.log('\n  Seeding invoices...');

  const existingInvoiceCount = await prisma.invoice.count();
  if (existingInvoiceCount >= 10) {
    console.log('    Invoices already seeded');
  } else {
    const invoiceConfigs = [
      // 3 PAID
      {
        status: InvoiceStatus.PAID,
        patientIdx: 0,
        appointmentIdx: 0,
        items: [
          { description: 'Cardiology Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 250 },
          { description: 'ECG - Electrocardiogram', category: 'PROCEDURE', quantity: 1, unitPrice: 75 },
        ],
      },
      {
        status: InvoiceStatus.PAID,
        patientIdx: 1,
        appointmentIdx: 1,
        items: [
          { description: 'Neurology Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 300 },
          { description: 'MRI Brain Scan', category: 'PROCEDURE', quantity: 1, unitPrice: 450 },
          { description: 'Sumatriptan 50mg (9 tablets)', category: 'MEDICATION', quantity: 1, unitPrice: 85 },
        ],
      },
      {
        status: InvoiceStatus.PAID,
        patientIdx: 2,
        appointmentIdx: 2,
        items: [
          { description: 'Orthopedic Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 275 },
          { description: 'X-Ray - Right Knee (2 views)', category: 'PROCEDURE', quantity: 1, unitPrice: 120 },
        ],
      },
      // 3 ISSUED
      {
        status: InvoiceStatus.ISSUED,
        patientIdx: 3,
        appointmentIdx: 3,
        items: [
          { description: 'Cardiology Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 250 },
          { description: 'Echocardiography', category: 'PROCEDURE', quantity: 1, unitPrice: 350 },
          { description: 'Complete Blood Count', category: 'LAB_TEST', quantity: 1, unitPrice: 45 },
        ],
      },
      {
        status: InvoiceStatus.ISSUED,
        patientIdx: 4,
        appointmentIdx: 4,
        items: [
          { description: 'Neurology Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 300 },
          { description: 'Nerve Conduction Study', category: 'PROCEDURE', quantity: 1, unitPrice: 280 },
        ],
      },
      {
        status: InvoiceStatus.ISSUED,
        patientIdx: 5,
        appointmentIdx: 5,
        items: [
          { description: 'Orthopedic Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 275 },
          { description: 'Lumbar MRI', category: 'PROCEDURE', quantity: 1, unitPrice: 500 },
        ],
      },
      // 2 PARTIALLY_PAID
      {
        status: InvoiceStatus.PARTIALLY_PAID,
        patientIdx: 6,
        appointmentIdx: 6,
        items: [
          { description: 'Pediatric Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 200 },
          { description: 'Blood Glucose Test', category: 'LAB_TEST', quantity: 1, unitPrice: 35 },
          { description: 'Thyroid Panel', category: 'LAB_TEST', quantity: 1, unitPrice: 95 },
        ],
        partialPayment: 200,
      },
      {
        status: InvoiceStatus.PARTIALLY_PAID,
        patientIdx: 7,
        appointmentIdx: 7,
        items: [
          { description: 'General Surgery Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 350 },
          { description: 'Abdominal Ultrasound', category: 'PROCEDURE', quantity: 1, unitPrice: 200 },
          { description: 'Liver Function Tests', category: 'LAB_TEST', quantity: 1, unitPrice: 65 },
        ],
        partialPayment: 350,
      },
      // 2 DRAFT
      {
        status: InvoiceStatus.DRAFT,
        patientIdx: 8,
        appointmentIdx: 8,
        items: [
          { description: 'Cardiology Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 320 },
          { description: 'Holter Monitor (24h)', category: 'PROCEDURE', quantity: 1, unitPrice: 180 },
        ],
      },
      {
        status: InvoiceStatus.DRAFT,
        patientIdx: 9,
        appointmentIdx: 9,
        items: [
          { description: 'Neurology Consultation', category: 'CONSULTATION', quantity: 1, unitPrice: 280 },
          { description: 'Sleep Study Referral', category: 'PROCEDURE', quantity: 1, unitPrice: 400 },
        ],
      },
    ];

    for (let i = 0; i < invoiceConfigs.length; i++) {
      const config = invoiceConfigs[i];
      const patRef = patientRefs[config.patientIdx % patientRefs.length];
      const appt = i < completedAppointments.length ? completedAppointments[i] : null;

      const subtotal = config.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const tax = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
      const total = subtotal + tax;
      const paidAmount =
        config.status === InvoiceStatus.PAID
          ? total
          : (config as { partialPayment?: number }).partialPayment || 0;

      const invoiceNumber = `INV-${String(2026).slice(-2)}${String(3).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          patientId: patRef.profileId,
          appointmentId: appt?.id ?? null,
          status: config.status,
          subtotal,
          tax,
          discount: 0,
          total,
          paidAmount,
          issuedAt: config.status !== InvoiceStatus.DRAFT ? daysAgo(i + 1) : null,
          dueDate: config.status !== InvoiceStatus.DRAFT ? daysFromNow(30 - i) : null,
          items: {
            create: config.items.map((item) => ({
              description: item.description,
              category: item.category,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.unitPrice * item.quantity,
            })),
          },
        },
      });

      // ─── 14. Payments (for paid/partially paid invoices) ─────────
      if (config.status === InvoiceStatus.PAID) {
        const methods: PaymentMethod[] = [PaymentMethod.CREDIT_CARD, PaymentMethod.INSURANCE, PaymentMethod.CASH];
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: total,
            method: methods[i % methods.length],
            reference: `PAY-${invoiceNumber}`,
            paidAt: daysAgo(i),
          },
        });
      } else if (config.status === InvoiceStatus.PARTIALLY_PAID) {
        const partialAmount = (config as { partialPayment?: number }).partialPayment || 0;
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: partialAmount,
            method: PaymentMethod.BANK_TRANSFER,
            reference: `PAY-PARTIAL-${invoiceNumber}`,
            paidAt: daysAgo(i),
          },
        });
      }
    }
    console.log('    Created 10 invoices with line items and payments');
  }

  // ─── 15. Hospital Settings ───────────────────────────────────────
  console.log('\n  Seeding hospital settings...');

  const settings = [
    { key: 'hospital.name', value: 'HMS University Hospital' },
    { key: 'hospital.address', value: 'Sakarya University Campus, Sakarya, Turkey' },
    { key: 'hospital.phone', value: '+90-264-295-0000' },
    { key: 'hospital.email', value: 'info@hms-hospital.edu.tr' },
    { key: 'hospital.website', value: 'https://hms-hospital.edu.tr' },
    { key: 'hospital.workingHours', value: '08:00-20:00' },
    { key: 'hospital.timezone', value: 'Europe/Istanbul' },
    { key: 'hospital.currency', value: 'TRY' },
    { key: 'hospital.taxRate', value: '0.08' },
    { key: 'hospital.appointmentSlotMinutes', value: '30' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log('    Hospital settings configured');

  // ─── 16. Holidays (Turkish national holidays) ───────────────────
  console.log('\n  Seeding holidays...');

  const currentYear = today.getFullYear();
  const holidays = [
    { name: 'New Year\'s Day (Yilbasi)', date: new Date(`${currentYear}-01-01`) },
    { name: 'National Sovereignty and Children\'s Day (Ulusal Egemenlik ve Cocuk Bayrami)', date: new Date(`${currentYear}-04-23`) },
    { name: 'Labour and Solidarity Day (Emek ve Dayanisma Gunu)', date: new Date(`${currentYear}-05-01`) },
    { name: 'Commemoration of Ataturk, Youth and Sports Day (Ataturk\'u Anma, Genclik ve Spor Bayrami)', date: new Date(`${currentYear}-05-19`) },
    { name: 'Victory Day (Zafer Bayrami)', date: new Date(`${currentYear}-08-30`) },
    { name: 'Republic Day (Cumhuriyet Bayrami)', date: new Date(`${currentYear}-10-29`) },
  ];

  // Clear and re-seed holidays (no unique constraint, so delete first)
  const existingHolidayCount = await prisma.holiday.count();
  if (existingHolidayCount === 0) {
    for (const h of holidays) {
      await prisma.holiday.create({ data: h });
    }
    console.log('    Created 6 Turkish national holidays');
  } else {
    console.log('    Holidays already seeded');
  }

  // ─── 17. Notifications (sample) ─────────────────────────────────
  console.log('\n  Seeding notifications...');

  const existingNotifCount = await prisma.notification.count();
  if (existingNotifCount === 0) {
    const notificationData = [
      // Patient notifications
      { userId: patientRefs[0].userId, type: 'APPOINTMENT_BOOKED', title: 'Appointment Confirmed', message: 'Your appointment with Dr. Ayse Yilmaz has been confirmed for tomorrow at 09:00.', isRead: false },
      { userId: patientRefs[0].userId, type: 'LAB_RESULTS_READY', title: 'Lab Results Available', message: 'Your Complete Blood Count results are now available. Please check your medical records.', isRead: true },
      { userId: patientRefs[1].userId, type: 'PRESCRIPTION_READY', title: 'Prescription Ready', message: 'Your prescription from Dr. Mehmet Kaya is ready for pickup at the pharmacy.', isRead: false },
      { userId: patientRefs[2].userId, type: 'APPOINTMENT_REMINDER', title: 'Appointment Reminder', message: 'Reminder: You have an appointment with Dr. Fatma Demir tomorrow at 10:30.', isRead: false },
      { userId: patientRefs[3].userId, type: 'INVOICE_ISSUED', title: 'New Invoice', message: 'A new invoice (INV-2603-0004) has been generated for your recent visit. Amount: 645.00 TRY.', isRead: true },
      { userId: patientRefs[4].userId, type: 'APPOINTMENT_CANCELLED', title: 'Appointment Cancelled', message: 'Your appointment on Monday has been cancelled per your request. Please book a new one if needed.', isRead: true },
      // Doctor notifications
      { userId: doctorRefs[0].userId, type: 'NEW_APPOINTMENT', title: 'New Patient Appointment', message: 'A new appointment has been booked with patient Ali Vural for tomorrow at 09:00.', isRead: false },
      { userId: doctorRefs[1].userId, type: 'LAB_RESULTS_READY', title: 'Lab Results for Your Patient', message: 'Lab results for patient Elif Ozkan (Blood Glucose) are now available for review.', isRead: false },
      { userId: doctorRefs[2].userId, type: 'APPOINTMENT_CANCELLED', title: 'Appointment Cancelled', message: 'Patient Burak Celik has cancelled the appointment scheduled for tomorrow.', isRead: true },
      // Staff notifications
      { userId: labTechUser.id, type: 'NEW_LAB_ORDER', title: 'New Lab Order', message: '5 new lab orders are pending sample collection. Priority: 2 URGENT, 1 STAT.', isRead: false },
      { userId: pharmacistUser.id, type: 'PRESCRIPTION_READY', title: 'New Prescriptions to Dispense', message: '3 new prescriptions are awaiting dispensing at the pharmacy counter.', isRead: false },
      { userId: nurseUser.id, type: 'PATIENT_CHECK_IN', title: 'Patient Checked In', message: 'Patient Ali Vural has checked in for the 09:00 appointment with Dr. Ayse Yilmaz.', isRead: false },
      { userId: receptionistUser.id, type: 'NEW_APPOINTMENT', title: 'New Walk-in Patient', message: 'A new walk-in patient requires appointment scheduling for Cardiology department.', isRead: false },
      { userId: adminUser.id, type: 'SYSTEM_ALERT', title: 'Low Medication Stock', message: 'Diazepam 5mg stock is below reorder level (150/15). Please initiate procurement.', isRead: false },
    ];

    for (const notif of notificationData) {
      await prisma.notification.create({ data: notif });
    }
    console.log('    Created 14 sample notifications');
  } else {
    console.log('    Notifications already seeded');
  }

  // ─── 18. Audit Logs (sample entries) ─────────────────────────────
  console.log('\n  Seeding audit logs...');

  const existingAuditCount = await prisma.auditLog.count();
  if (existingAuditCount === 0) {
    const auditData = [
      { userId: superAdmin.id, action: 'CREATE', entity: 'User', entityId: adminUser.id, changes: '{"role":"ADMIN","email":"admin@hms.com"}', ipAddress: '192.168.1.1' },
      { userId: doctorRefs[0].userId, action: 'CREATE', entity: 'Appointment', entityId: appointmentRecords[0]?.id, changes: '{"status":"PENDING"}', ipAddress: '192.168.1.10' },
      { userId: doctorRefs[0].userId, action: 'UPDATE', entity: 'Appointment', entityId: appointmentRecords[0]?.id, changes: '{"status":{"from":"PENDING","to":"COMPLETED"}}', ipAddress: '192.168.1.10' },
      { userId: doctorRefs[1].userId, action: 'CREATE', entity: 'MedicalRecord', entityId: medRecordRefs[1]?.id, changes: '{"diagnosis":"Migraine without aura"}', ipAddress: '192.168.1.11' },
      { userId: pharmacistUser.id, action: 'UPDATE', entity: 'Prescription', entityId: prescriptionRefs[0]?.id, changes: '{"status":{"from":"PENDING","to":"DISPENSED"}}', ipAddress: '192.168.1.20' },
      { userId: labTechUser.id, action: 'UPDATE', entity: 'LabOrder', changes: '{"status":{"from":"IN_PROGRESS","to":"COMPLETED"}}', ipAddress: '192.168.1.21' },
      { userId: receptionistUser.id, action: 'CREATE', entity: 'Appointment', changes: '{"type":"CONSULTATION","department":"Cardiology"}', ipAddress: '192.168.1.5' },
    ];

    for (const log of auditData) {
      await prisma.auditLog.create({ data: log });
    }
    console.log('    Created 7 audit log entries');
  } else {
    console.log('    Audit logs already seeded');
  }

  // ═══════════════════════════════════════════════════════════════════
  console.log('\n========================================');
  console.log('  HMS Seed completed successfully!');
  console.log('========================================');
  console.log('\nDemo credentials (all use password123):');
  console.log('  Super Admin  : superadmin@example.com / superadmin123');
  console.log('  Admin        : admin@hms.com');
  console.log('  Receptionist : reception@hms.com');
  console.log('  Nurse        : nurse.aysel@hms.com');
  console.log('  Pharmacist   : pharmacist@hms.com');
  console.log('  Lab Tech     : lab.tech@hms.com');
  console.log('  Doctors      : dr.ayse@example.com, dr.mehmet@example.com, ...');
  console.log('  Patients     : ali.vural@example.com, elif.ozkan@example.com, ...');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

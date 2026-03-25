import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 10);
  const adminHash = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'superadmin123',
    10,
  );

  // ─── Super Admin ─────────────────────────────────────────────
  const admin = await prisma.user.upsert({
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
  console.log(`  Seeded: ${admin.email} (${admin.role})`);

  // ─── Departments ─────────────────────────────────────────────
  const departments = [
    { name: 'Cardiology', description: 'Heart and cardiovascular system', floor: '3', phone: '+90-312-555-0101' },
    { name: 'Neurology', description: 'Brain and nervous system', floor: '4', phone: '+90-312-555-0102' },
    { name: 'Orthopedics', description: 'Bones, joints, and muscles', floor: '2', phone: '+90-312-555-0103' },
    { name: 'Pediatrics', description: 'Children and infant care', floor: '1', phone: '+90-312-555-0104' },
    { name: 'General Surgery', description: 'Surgical procedures', floor: '5', phone: '+90-312-555-0105' },
  ];

  const deptRecords = [];
  for (const dept of departments) {
    const record = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    deptRecords.push(record);
    console.log(`  Seeded department: ${record.name}`);
  }

  // ─── Doctors ─────────────────────────────────────────────────
  const doctors = [
    { email: 'dr.ayse@example.com', firstName: 'Ayşe', lastName: 'Yılmaz', phone: '+90-532-100-0001', specialization: 'Cardiologist', licenseNumber: 'TR-DOC-10001', departmentIndex: 0, bio: 'Specialist in interventional cardiology with 15 years of experience.', yearsExperience: 15, consultationFee: 250 },
    { email: 'dr.mehmet@example.com', firstName: 'Mehmet', lastName: 'Kaya', phone: '+90-532-100-0002', specialization: 'Neurologist', licenseNumber: 'TR-DOC-10002', departmentIndex: 1, bio: 'Expert in epilepsy and movement disorders.', yearsExperience: 10, consultationFee: 300 },
    { email: 'dr.fatma@example.com', firstName: 'Fatma', lastName: 'Demir', phone: '+90-532-100-0003', specialization: 'Orthopedic Surgeon', licenseNumber: 'TR-DOC-10003', departmentIndex: 2, bio: 'Sports medicine and joint replacement specialist.', yearsExperience: 12, consultationFee: 275 },
  ];

  for (const doc of doctors) {
    const existingUser = await prisma.user.findUnique({ where: { email: doc.email } });
    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          email: doc.email,
          passwordHash: hash,
          role: Role.DOCTOR,
          firstName: doc.firstName,
          lastName: doc.lastName,
          phone: doc.phone,
        },
      });

      await prisma.doctorProfile.create({
        data: {
          userId: user.id,
          specialization: doc.specialization,
          licenseNumber: doc.licenseNumber,
          departmentId: deptRecords[doc.departmentIndex].id,
          bio: doc.bio,
          yearsExperience: doc.yearsExperience,
          consultationFee: doc.consultationFee,
        },
      });

      console.log(`  Seeded doctor: ${doc.firstName} ${doc.lastName} (${doc.specialization})`);
    } else {
      console.log(`  Doctor already exists: ${doc.email}`);
    }
  }

  // ─── Patients ────────────────────────────────────────────────
  const patients = [
    { email: 'ali.vural@example.com', firstName: 'Ali', lastName: 'Vural', phone: '+90-533-200-0001', gender: 'Male', bloodType: 'A+', allergies: 'Penicillin', emergencyContactName: 'Zeynep Vural', emergencyContactPhone: '+90-533-200-0010', emergencyContactRelation: 'Spouse', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-001' },
    { email: 'elif.ozkan@example.com', firstName: 'Elif', lastName: 'Özkan', phone: '+90-533-200-0002', gender: 'Female', bloodType: 'B+', allergies: null, emergencyContactName: 'Hasan Özkan', emergencyContactPhone: '+90-533-200-0020', emergencyContactRelation: 'Father', insuranceProvider: 'Anadolu Sigorta', insurancePolicyNumber: 'ANS-2024-042' },
    { email: 'burak.celik@example.com', firstName: 'Burak', lastName: 'Çelik', phone: '+90-533-200-0003', gender: 'Male', bloodType: 'O-', allergies: 'Aspirin, Latex', emergencyContactName: 'Selin Çelik', emergencyContactPhone: '+90-533-200-0030', emergencyContactRelation: 'Sister', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-078' },
    { email: 'deniz.arslan@example.com', firstName: 'Deniz', lastName: 'Arslan', phone: '+90-533-200-0004', gender: 'Female', bloodType: 'AB+', allergies: null, emergencyContactName: 'Murat Arslan', emergencyContactPhone: '+90-533-200-0040', emergencyContactRelation: 'Husband', insuranceProvider: 'Allianz', insurancePolicyNumber: 'ALZ-2024-115' },
    { email: 'can.yildiz@example.com', firstName: 'Can', lastName: 'Yıldız', phone: '+90-533-200-0005', gender: 'Male', bloodType: 'A-', allergies: 'Sulfa drugs', emergencyContactName: 'Aylin Yıldız', emergencyContactPhone: '+90-533-200-0050', emergencyContactRelation: 'Mother', insuranceProvider: 'SGK', insurancePolicyNumber: 'SGK-2024-203' },
  ];

  for (const pat of patients) {
    const existingUser = await prisma.user.findUnique({ where: { email: pat.email } });
    if (!existingUser) {
      const user = await prisma.user.create({
        data: {
          email: pat.email,
          passwordHash: hash,
          role: Role.PATIENT,
          firstName: pat.firstName,
          lastName: pat.lastName,
          phone: pat.phone,
          gender: pat.gender,
        },
      });

      await prisma.patientProfile.create({
        data: {
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

      console.log(`  Seeded patient: ${pat.firstName} ${pat.lastName}`);
    } else {
      console.log(`  Patient already exists: ${pat.email}`);
    }
  }

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

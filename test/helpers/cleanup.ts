import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Delete all test data in correct FK order.
 * Uses multiple transactions to avoid FK constraint issues.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Layer 1: leaf tables
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.aIAnalysisResult.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.dispensing.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.labResult.deleteMany(),
    prisma.vitalSigns.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.emergencyVisit.deleteMany(),
  ]);
  // Layer 2: mid-level tables
  await prisma.$transaction([
    prisma.prescription.deleteMany(),
    prisma.labOrder.deleteMany(),
    prisma.medicalRecord.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.doctorSchedule.deleteMany(),
    prisma.medication.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.holiday.deleteMany(),
  ]);
  // Layer 3: profiles and relations
  await prisma.$transaction([
    prisma.doctorProfile.deleteMany(),
    prisma.patientProfile.deleteMany(),
    prisma.nationalPatient.deleteMany(),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
  ]);
  // Layer 4: base entities
  await prisma.$transaction([
    prisma.hospital.deleteMany(),
    prisma.city.deleteMany(),
  ]);
}

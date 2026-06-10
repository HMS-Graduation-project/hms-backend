# HMS — Seed Data & Demo Credentials Reference

> **Hospital Management System (HMS) — National platform for the 14 governorates of Syria**
> This document lists every user account created by the seed, their email, password, role,
> permissions, and exactly what each one can access and test. Use it as the master reference
> during demos, walkthroughs, and QA.

---

## 1. At a glance

| Item | Value |
|---|---|
| Database | PostgreSQL (`hms`), seeded via `npx prisma db seed` |
| Frontend | `http://localhost` (nginx) / `http://localhost:5173` (Vite dev) |
| Backend API | `http://localhost:3000/api/v1` · Swagger: `http://localhost:3000/api/docs` |
| **Default password (everyone except super admin)** | **`password123`** |
| **Super Admin** | **`admin@example.com` / `admin123`** *(comes from `hms-infra/.env` → `ADMIN_EMAIL` / `ADMIN_PASSWORD`; if those are unset the seed default is `superadmin@example.com` / `superadmin123`)* |
| Network size | **45 hospitals · 18 cities · all 14 governorates** |
| Users | ~684 (1 super admin, 1 ministry, 14 regional, ~42 hospital admins, hundreds of doctors/nurses/pharmacists/lab techs/receptionists/patients) |

### Network scale created by the seed

| Entity | Rows | Entity | Rows |
|---|---:|---|---:|
| Cities (incl. 14 governorates) | 18 | Lab orders (+ results) | 440 (173) |
| Hospitals | 45 | Medications (incl. low-stock) | 519 |
| Departments | 222 | Invoices (+ payments) | 346 (173) |
| Users | 684 | Wards / Beds | 130 / 778 |
| Doctors (+ schedules) | 263 (1343) | Admissions (+ transfers) | 129 (43) |
| National patients / profiles | 524 / 536 | Emergency visits | 216 |
| Appointments | 1060 | Cross-governorate referrals | 22 |
| Medical records (+ vitals) | 304 (178) | **AI X-ray analyses** | **126** |
| Prescriptions (+ dispensings) | 220 (252) | Notifications / Audit logs | 266 / 217 |

The data is interconnected so that **dashboards, statistics, filters, search, reports and every
workflow look like a real production environment**: appointments span every status across past/
today/future, invoices cover PAID/ISSUED/PARTIALLY_PAID/DRAFT/OVERDUE, beds reflect live occupancy,
emergency queues show all triage levels, referrals form real city-to-city flows, and AI analyses
exist in PENDING/REVIEWED/APPROVED states.

---

## 2. The role model (how access works)

The platform is **multi-tenant** with three scope levels carried inside the JWT:

| Scope | Who | Sees |
|---|---|---|
| **National** | `SUPER_ADMIN`, `MINISTRY_ADMIN` | Every hospital, every city, national rollups |
| **Regional (city)** | `REGIONAL_ADMIN` (bound to one `cityId`) | All hospitals in their governorate, regional reports |
| **Hospital** | `ADMIN`, `HOSPITAL_ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, `PHARMACIST`, `LAB_TECHNICIAN` | Only their own hospital's data (auto-filtered by `hospitalId`) |
| **Self (cross-hospital)** | `PATIENT` | Only their own records, fanned out across every hospital where they have a profile |

> A hospital-scoped user inherits their `cityId` from `hospital.cityId` at login. A `PATIENT`'s
> national identity (`NationalPatient`) links all their per-hospital `PatientProfile`s, so the
> patient portal shows a unified cross-hospital record. An **accepted/completed referral** grants
> the receiving hospital read access to the patient's records at every hospital.

---

## 3. Featured / fixed accounts (log in directly)

All passwords below are **`password123`** unless noted. These are the curated accounts used in the
scripted demo and the richest data lives at **Damascus General Hospital**.

### 3.1 Platform & national

| Email | Password | Role | What they can access / test |
|---|---|---|---|
| `admin@example.com` | `admin123` | **SUPER_ADMIN** | Everything, nationally: all hospitals & users, **audit logs**, settings, every clinical & admin module, national analytics & reporting, AI analyses. The "god" account. |
| `ministry@hms.com` | `password123` | **MINISTRY_ADMIN** | National **reporting** (national/regional summary, referral-flow map, disease-trends), the **national patient registry** (search, view, create, merge duplicates), city management. No single-hospital operations. |

### 3.2 Regional admins — one per governorate

All `password123`. Each is bound to its governorate's capital city and sees **all hospitals in that
governorate** plus regional reports & the patient registry.

| Email | Governorate | Email | Governorate |
|---|---|---|---|
| `regional.damascus@hms.com` | Damascus | `regional.daraa@hms.com` | Daraa |
| `regional.ruraldamascus@hms.com` | Rural Damascus | `regional.assuwayda@hms.com` | As-Suwayda |
| `regional.aleppo@hms.com` | Aleppo | `regional.quneitra@hms.com` | Quneitra |
| `regional.homs@hms.com` | Homs | `regional.deirezzor@hms.com` | Deir ez-Zor |
| `regional.hama@hms.com` | Hama | `regional.alhasakah@hms.com` | Al-Hasakah |
| `regional.latakia@hms.com` | Latakia | `regional.raqqa@hms.com` | Raqqa |
| `regional.tartus@hms.com` | Tartus | `regional.idlib@hms.com` | Idlib |

### 3.3 Damascus General Hospital (`DAM-GEN-01`) — flagship, richest data

**Staff** (all `password123`):

| Email | Name | Role | What to test |
|---|---|---|---|
| `admin@hms.com` | Kemal Atasoy | **ADMIN** | Full hospital administration: create/update **users**, manage **settings**, departments, doctors, patients, billing, inpatient, everything within Damascus General. |
| `reception@hms.com` | Seda Korkmaz | **RECEPTIONIST** | Register patients, book/reschedule/cancel **appointments**, emergency intake, create **invoices** & record payments. |
| `nurse.aysel@hms.com` | Aysel Dogan | **NURSE** | Record **vital signs**, **emergency triage**, view patients/records, assist inpatient (bed status, transfers). |
| `pharmacist@hms.com` | Emre Bulut | **PHARMACIST** | **Dispense** prescriptions (decrements stock), manage **medication inventory**, view **low-stock** alerts, update prescription status. |
| `lab.tech@hms.com` | Gizem Aksoy | **LAB_TECHNICIAN** | Advance **lab order** status (sample collected → in progress → completed), **enter results** (mark abnormal). |

**Doctors** (all `password123`, role `DOCTOR`):

| Email | Name | Specialization | Department |
|---|---|---|---|
| `dr.ayse@example.com` | Ayse Yilmaz | Cardiologist | Cardiology |
| `dr.mehmet@example.com` | Mehmet Kaya | Neurologist | Neurology |
| `dr.fatma@example.com` | Fatma Demir | Orthopedic Surgeon | Orthopedics |
| `dr.ahmet@example.com` | Ahmet Ozturk | Pediatrician | Pediatrics |
| `dr.zeynep@example.com` | Zeynep Cetin | General Surgeon | General Surgery |
| `dr.hasan@example.com` | Hasan Sahin | Cardiologist | Cardiology (Mon–Sat) |
| `dr.elif@example.com` | Elif Yildiz | Neurologist | Neurology |
| `dr.murat@example.com` | Murat Erdogan | Orthopedic Surgeon | Orthopedics (afternoon shift) |

> **Doctors test:** today's schedule & appointments, create **medical records** + diagnoses for
> completed visits, write **prescriptions**, order **lab tests**, claim/triage **emergency** cases,
> **admit/discharge/transfer** inpatients, create & accept **referrals**, request & review **AI X-ray analyses**.

**Patients** (all `password123`, role `PATIENT`, `@example.com`) — these have **portal logins**:

`ali.vural`, `elif.ozkan`, `burak.celik`, `deniz.arslan`, `can.yildiz`, `selin.kara`, `emre.tas`,
`aylin.polat`, `tolga.kurt`, `derya.akin`, `omer.yalcin`, `pinar.guler`, `serkan.dogan`,
`yesim.kocer`, `cem.ozdemir`, `melis.aydin`, `volkan.sen`, `esra.bayrak`, `hakan.turan`, `nihan.aksoy`

| Special patient | Why it matters |
|---|---|
| `can.yildiz@example.com` | **Cross-hospital portal demo** — has profiles at **Damascus + Aleppo**; portal shows appointments/records fanned across both. |
| `burak.celik@example.com` | **Referral-chain demo** — record spans **Damascus → Aleppo → Homs** to showcase the unified national identity. |
| `ali.vural@example.com` | Active emergency + cardiology admission + an urgent **referral to Aleppo**. |

> **Patients test:** the **patient portal** (`/me`) — view unified national health record, book/cancel
> appointments at any hospital, see prescriptions, lab results, invoices, and referral history.

### 3.4 Aleppo Central (`ALP-CTR-01`) & Homs Regional (`HOM-REG-01`) — referral partners

| Email | Name | Role / Specialization | Hospital |
|---|---|---|---|
| `admin.aleppo@hms.com` | Rami Haddad | HOSPITAL_ADMIN | Aleppo Central |
| `dr.nader.aleppo@hms.com` | Nader Khouri | DOCTOR — Interventional Cardiology | Aleppo Central |
| `dr.layla.aleppo@hms.com` | Layla Nasser | DOCTOR — General Surgery | Aleppo Central |
| `admin.homs@hms.com` | Faris Mansour | HOSPITAL_ADMIN | Homs Regional |
| `dr.salma.homs@hms.com` | Salma Idris | DOCTOR — Internal Medicine | Homs Regional |

---

## 4. National network — login pattern for all 42 generated hospitals

Every hospital below is **fully populated** (departments, 6 doctors with weekly schedules,
receptionist, nurse, pharmacist, lab tech, 12 patients, appointments, records, prescriptions, labs,
inventory, invoices, wards/beds/admissions, emergency visits, AI analyses, notifications, settings,
audit logs). Accounts follow a **deterministic pattern** — substitute the hospital `CODE`
(lowercase). **All passwords are `password123`.**

| Role | Email pattern | Example (`HMA-NAT-01`) |
|---|---|---|
| Hospital admin (`HOSPITAL_ADMIN`) | `admin.<code>@hms.com` | `admin.hma-nat-01@hms.com` |
| Receptionist | `reception.<code>@hms.com` | `reception.hma-nat-01@hms.com` |
| Nurse | `nurse.<code>@hms.com` | `nurse.hma-nat-01@hms.com` |
| Pharmacist | `pharmacist.<code>@hms.com` | `pharmacist.hma-nat-01@hms.com` |
| Lab technician | `lab.<code>@hms.com` | `lab.hma-nat-01@hms.com` |
| Doctors (6) | `dr.<1–6>.<code>@hms.com` | `dr.1.hma-nat-01@hms.com` … `dr.6.hma-nat-01@hms.com` |
| Patients with portal login (4) | `patient.<1–4>.<code>@hms.com` | `patient.1.hma-nat-01@hms.com` … `patient.4.hma-nat-01@hms.com` |

> The other 8 patients per hospital exist in the registry **without** a login (staff-managed),
> mirroring real walk-in/registered patients.

### 4.1 Hospital codes by governorate

> **Flagship** hospitals (★) use the *featured* accounts in §3.3/§3.4, **not** the pattern above.
> Every other hospital uses the §4 pattern.

| Governorate | Hospitals (`code` — name) |
|---|---|
| **Damascus** | `DAM-GEN-01` ★ Damascus General · `DAM-MWS-01` Al-Mouwasat · `DAM-MJT-01` Al-Mujtahid · `DAM-CHL-01` Damascus Children's |
| **Rural Damascus** | `RDM-DOU-01` Douma Central · `RDM-ZBD-01` Al-Zabadani National · `RDM-QTN-01` Al-Qutayfah Maternity |
| **Aleppo** | `ALP-CTR-01` ★ Aleppo Central · `ALP-UNI-01` Aleppo University · `ALP-RAZ-01` Al-Razi · `ALP-CHL-01` Aleppo Children's · `MNB-NAT-01` Manbij National |
| **Homs** | `HOM-REG-01` ★ Homs Regional · `HOM-WTN-01` Al-Watani · `HOM-BSL-01` Al-Basel Heart Center · `HOM-ZAH-01` Al-Zahrawi Maternity |
| **Hama** | `HMA-NAT-01` Hama National · `HMA-HRT-01` Al-Horani · `HMA-MHR-01` Al-Mahardah General |
| **Latakia** | `LAT-TSH-01` Tishreen University · `LAT-NAT-01` Latakia National · `JBL-NAT-01` Jableh National |
| **Tartus** | `TAR-NAT-01` Tartus National · `TAR-BSL-01` Al-Basel Tartus · `BNS-NAT-01` Baniyas National |
| **Idlib** | `IDL-CTR-01` Idlib Central · `IDL-UNI-01` Idlib University · `IDL-MRT-01` Maaret al-Numan National |
| **Daraa** | `DAR-NAT-01` Daraa National · `DAR-IZR-01` Izra National · `DAR-CHL-01` Daraa Children's |
| **As-Suwayda** | `SWD-NAT-01` As-Suwayda National · `SWD-BSL-01` Al-Basel Suwayda · `SWD-MTR-01` Suwayda Maternity & Children |
| **Quneitra** | `QUN-NAT-01` Quneitra National · `QUN-BAT-01` Al-Baath Quneitra |
| **Deir ez-Zor** | `DEZ-NAT-01` Deir ez-Zor National · `DEZ-UNI-01` Deir ez-Zor University · `DEZ-MYD-01` Al-Mayadin General |
| **Al-Hasakah** | `HAS-NAT-01` Al-Hasakah National · `HAS-CHL-01` Al-Hasakah Children's · `QAM-NAT-01` Qamishli National |
| **Raqqa** | `RAQ-NAT-01` Raqqa National · `RAQ-BSL-01` Al-Basel Raqqa · `RAQ-TBQ-01` Al-Tabqa General |

**Ready-to-use examples:**
`admin.swd-nat-01@hms.com` (Suwayda admin) · `dr.1.dez-uni-01@hms.com` (Deir ez-Zor Univ. doctor) ·
`pharmacist.raq-nat-01@hms.com` (Raqqa pharmacist) · `patient.1.idl-ctr-01@hms.com` (Idlib patient portal) ·
`lab.lat-tsh-01@hms.com` (Tishreen lab tech) — **all `password123`**.

---

## 5. Role → permissions & "what to test" matrix

| Role | Scope | Key capabilities (✓ = can) | What to test in the demo |
|---|---|---|---|
| **SUPER_ADMIN** | National | Everything ✓ incl. user mgmt, settings, **audit logs**, all clinical/admin modules | Switch between any hospital's data; view national analytics; read the audit trail. |
| **MINISTRY_ADMIN** | National | Reporting ✓, national registry ✓ (incl. **merge**), city mgmt ✓; no hospital ops | National/regional summary, referral-flow map, disease-trends, search/merge patients. |
| **REGIONAL_ADMIN** | One governorate | Regional reporting ✓, registry ✓ (search/create/update), referrals ✓ (view) | Confirm they only see their governorate; regional bed-occupancy & ER KPIs. |
| **ADMIN** | One hospital | Users ✓ (create+update), settings ✓, doctors/patients/departments ✓, billing ✓, inpatient ✓, all clinical (read) | Create a new doctor/user, edit settings, manage wards/beds, full hospital control. |
| **HOSPITAL_ADMIN** | One hospital | Like ADMIN but **no** user-update / settings / user-deactivate | Operate a hospital: patients, appointments, emergency, inpatient, referrals. |
| **DOCTOR** | One hospital | Appointments ✓, **medical records** ✓ (create), **prescriptions** ✓, **lab orders** ✓, emergency triage/claim/disposition ✓, admissions ✓, referrals ✓ (create/accept), **AI analyses** ✓ | Full clinical visit: consult → diagnose → prescribe → order labs → refer; review AI X-ray. |
| **NURSE** | One hospital | **Vital signs** ✓, emergency triage ✓, inpatient (bed status/transfer) ✓, read patients/records | Triage an ER arrival; record vitals; assist inpatient transfers. |
| **RECEPTIONIST** | One hospital | Patients ✓ (create/update), **appointments** ✓, ER intake ✓, **invoices/payments** ✓, registry ✓ (create) | Register a patient, book an appointment, take a payment, intake an ER walk-in. |
| **PHARMACIST** | One hospital | **Dispensing** ✓ (exclusive), medication inventory ✓, prescription status ✓, low-stock ✓ | Dispense a pending prescription (watch stock drop), review low-stock alerts. |
| **LAB_TECHNICIAN** | One hospital | Lab order status ✓ (exclusive), **enter results** ✓, read records | Move an order to completed and enter an abnormal result. |
| **PATIENT** | Self (all hospitals) | Patient portal `/me` ✓: unified record, book/cancel appts, view rx/labs/invoices/referrals | Log in as `can.yildiz@example.com` to see cross-hospital records. |

---

## 6. Suggested end-to-end demo script

1. **National view** — log in as `admin@example.com` (SUPER_ADMIN) → analytics dashboard shows
   536 patients / 263 doctors across **45 hospitals**. Open audit logs.
2. **Ministry oversight** — `ministry@hms.com` → Reporting → **referral-flow** (city-to-city map)
   and **disease-trends**; search the **national registry**.
3. **Regional** — `regional.hama@hms.com` → confirm scope is limited to Hama's hospitals & KPIs.
4. **Reception** — `reception@hms.com` → register a patient and book an appointment with `dr.ayse@example.com`.
5. **Doctor visit** — `dr.ayse@example.com` → open today's appointment → write a medical record
   (diagnosis), a **prescription**, and a **lab order**; request an **AI chest X-ray analysis**.
6. **Pharmacy** — `pharmacist@hms.com` → dispense the prescription (stock decrements; check **low-stock**).
7. **Lab** — `lab.tech@hms.com` → complete the lab order and enter the result.
8. **Emergency** — `nurse.aysel@hms.com` → triage an ER arrival → `dr.fatma@example.com` claims & dispositions it.
9. **Inpatient** — admit a patient to a ward/bed, transfer beds, then discharge (bed frees up).
10. **Billing** — `reception@hms.com` → issue an invoice and record a payment (status → PAID).
11. **Cross-hospital referral** — `dr.ayse@example.com` refers a patient to Aleppo →
    `dr.nader.aleppo@hms.com` (`admin.aleppo@hms.com`) accepts → cross-hospital record access opens.
12. **Patient portal** — `can.yildiz@example.com` → see the unified record spanning Damascus + Aleppo.
13. **Browse the network** — log in to any governorate, e.g. `admin.raq-nat-01@hms.com`,
    `dr.1.dez-uni-01@hms.com`, `patient.1.idl-ctr-01@hms.com` — every hospital is fully populated.

---

## 7. How the data was generated (for maintainers)

- **`prisma/seed.ts`** — builds the flagship demo (Damascus General + Aleppo Central + Homs Regional)
  and all the §3 featured accounts. Unchanged behaviour; existing walkthroughs still work.
- **`prisma/seed-network.ts`** *(new)* — layers the **national network**: 14 regional admins and 42
  fully-populated hospitals across every governorate, plus 18+ cross-governorate referrals.
- **Idempotent**: re-running `npx prisma db seed` skips any hospital that already has doctors and
  never touches the three flagship hospitals. Safe to run repeatedly.
- **Run it:** `cd hms-backend && npx prisma db seed` (or inside Docker:
  `docker exec hms-backend npx prisma db seed`).
- **Reset & reseed:** `npx prisma db push --force-reset && npx prisma db seed`.

### Consistency guarantees baked into the seed
- Occupied beds **exactly** match active admissions.
- Appointments cover every status; invoices cover every status incl. OVERDUE; payments roll up to `paidAmount`.
- Emergency visits span multiple triage levels (RED/ORANGE/YELLOW/GREEN) and multiple statuses (arrived, in-triage, in-treatment, discharged, admitted); some patients are unidentified at arrival.
- Referrals are all cross-city, across PENDING/ACCEPTED/REJECTED/COMPLETED, and accepted ones create shadow profiles at the receiving hospital.
- AI analyses span PENDING_REVIEW/REVIEWED/APPROVED, single-model and weighted-average ensemble.

---

*Generated for the HMS demo. Keep this file private — it contains login credentials for seed/demo data only.*

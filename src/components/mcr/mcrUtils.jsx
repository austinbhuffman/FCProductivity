import { differenceInDays, addDays, parseISO, isValid, format } from "date-fns";

export function calcMedicareDay(benefitPeriodStartDate, dischargeDate) {
  if (!benefitPeriodStartDate) return 0;
  const start = parseISO(benefitPeriodStartDate);
  if (!isValid(start)) return 0;
  const end = dischargeDate && isValid(parseISO(dischargeDate))
    ? parseISO(dischargeDate)
    : new Date();
  return Math.max(0, differenceInDays(end, start) + 1);
}

export function getDayCategory(day) {
  if (day <= 60) return "Days 1–60 Deductible";
  if (day <= 90) return "Days 61–90 Coinsurance";
  return "Days 91+ Lifetime Reserve";
}

export function getAlertLevel(day) {
  if (day < 75) return "🟢 Normal";
  if (day <= 85) return "🟡 Monitor";
  if (day <= 90) return "🔴 Form Needed Soon";
  return "⚫ Lifetime Reserve Active";
}

export function getAlertPriority(alertLevel) {
  if (alertLevel.startsWith("⚫")) return 0;
  if (alertLevel.startsWith("🔴")) return 1;
  if (alertLevel.startsWith("🟡")) return 2;
  return 3;
}

export function isLifetimeFormRequired(day) {
  return day >= 86;
}

export function calcLrdRemaining(lrdPreviouslyUsed) {
  return Math.max(0, 60 - (lrdPreviouslyUsed || 0));
}

export function isCensusReviewOverdue(caseStatus, lastCensusVerified) {
  if (caseStatus !== "Active") return false;
  if (!lastCensusVerified) return true;
  const last = parseISO(lastCensusVerified);
  if (!isValid(last)) return true;
  return differenceInDays(new Date(), last) > 7;
}

export function calcDaysRemainingInPeriod(daysRemainingAtEntry, admissionDate, dischargeDate) {
  if (daysRemainingAtEntry == null || !admissionDate) return null;
  const admit = parseISO(admissionDate);
  if (!isValid(admit)) return null;
  const end = dischargeDate && isValid(parseISO(dischargeDate)) ? parseISO(dischargeDate) : new Date();
  const daysSinceAdmission = Math.max(0, differenceInDays(end, admit));
  return Math.max(0, daysRemainingAtEntry - daysSinceAdmission);
}

// Calculates the NEXT UPCOMING transition date for the patient.
// Always returns a future date — if the stored category's transition has passed,
// advances to the next upcoming milestone.
export function calcNextCategoryDate(admissionDate, daysRemainingAtEntry, benefitPeriodCategory) {
  if (!admissionDate || daysRemainingAtEntry == null) return null;
  if (benefitPeriodCategory === "Lifetime Reserve Days" || benefitPeriodCategory === "Beyond Lifetime Reserve Days") return null;

  const admit = parseISO(admissionDate);
  if (!isValid(admit)) return null;
  const today = new Date();

  if (benefitPeriodCategory === "Deductible Days") {
    // Transition: Deductible → Coinsurance = admission + daysRemainingAtEntry
    const deductibleEnd = addDays(admit, daysRemainingAtEntry);
    if (deductibleEnd > today) return format(deductibleEnd, "yyyy-MM-dd");
    // Already past deductible — next milestone is Coinsurance → LRD
    const lrdStart = addDays(admit, daysRemainingAtEntry + 30);
    if (lrdStart > today) return format(lrdStart, "yyyy-MM-dd");
    // Already in LRD territory
    return null;
  }

  if (benefitPeriodCategory === "Coinsurance Days") {
    // Transition: Coinsurance → LRD = admission + daysRemainingAtEntry
    // (daysRemainingAtEntry already = days left in Coinsurance period)
    const lrdStart = addDays(admit, daysRemainingAtEntry);
    if (lrdStart > today) return format(lrdStart, "yyyy-MM-dd");
    return null;
  }

  return null;
}

// Calculates the date the patient will enter (or entered) Lifetime Reserve Days (Day 91)
// based on admission date and days_remaining_at_entry in their current period
export function calcLifetimeStartDate(admissionDate, daysRemainingAtEntry, benefitPeriodCategory) {
  if (!admissionDate) return null;
  const admit = parseISO(admissionDate);
  if (!isValid(admit)) return null;

  // Days remaining tells us how many days are left at entry in the current bucket.
  // We need to figure out how many total Medicare days remain until Day 91.
  let daysUntilLRD = 0;

  if (benefitPeriodCategory === "Lifetime Reserve Days" || benefitPeriodCategory === "Beyond Lifetime Reserve Days") {
    // Already in or past LRD — return the admission date as the start (patient is already there)
    return format(admit, "yyyy-MM-dd");
  } else if (benefitPeriodCategory === "Coinsurance Days") {
    // Coinsurance ends daysRemainingAtEntry days after admission, then LRD starts
    daysUntilLRD = daysRemainingAtEntry != null ? daysRemainingAtEntry : null;
  } else if (benefitPeriodCategory === "Deductible Days") {
    // Deductible ends daysRemainingAtEntry days after admission, then 30 coinsurance days, then LRD
    daysUntilLRD = daysRemainingAtEntry != null ? daysRemainingAtEntry + 30 : null;
  } else {
    return null;
  }

  if (daysUntilLRD == null) return null;
  const lrdDate = addDays(admit, daysUntilLRD);
  return format(lrdDate, "yyyy-MM-dd");
}

export function enrichCase(c) {
  const day = calcMedicareDay(c.benefit_period_start_date, c.discharge_date);
  const alertLevel = getAlertLevel(day);
  const daysRemainingInPeriod = calcDaysRemainingInPeriod(c.days_remaining_at_entry, c.admission_date, c.discharge_date);
  const lifetimeStartDate = calcLifetimeStartDate(c.admission_date, c.days_remaining_at_entry, c.benefit_period_category);
  const nextCategoryDate = calcNextCategoryDate(c.admission_date, c.days_remaining_at_entry, c.benefit_period_category, c.discharge_date);
  return {
    ...c,
    _day: day,
    _dayCategory: getDayCategory(day),
    _alertLevel: alertLevel,
    _alertPriority: getAlertPriority(alertLevel),
    _lifetimeFormRequired: isLifetimeFormRequired(day),
    _lrdRemaining: calcLrdRemaining(c.lrd_previously_used),
    _censusReviewOverdue: isCensusReviewOverdue(c.case_status, c.last_census_verified),
    _daysRemainingInPeriod: daysRemainingInPeriod,
    _lifetimeStartDate: lifetimeStartDate,
    _nextCategoryDate: nextCategoryDate,
  };
}

export function isFormSigned(formStatus) {
  return formStatus === "Signed Opt-In" || formStatus === "Signed Opt-Out";
}

export function generateCaseId() {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `MCR-${year}-${num}`;
}
import { startOfYear, subYears, format } from "date-fns";

// Helper function to parse date strings as local dates (avoiding timezone issues)
export function parseLocalDate(dateString) {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getFiscalYearDates(asOfDate, fiscalStartMonth = 1) {
  const asOf = parseLocalDate(asOfDate);
  const currentYear = asOf.getFullYear();
  const currentMonth = asOf.getMonth() + 1;
  
  let fiscalYearStart;
  if (currentMonth >= fiscalStartMonth) {
    fiscalYearStart = new Date(currentYear, fiscalStartMonth - 1, 1);
  } else {
    fiscalYearStart = new Date(currentYear - 1, fiscalStartMonth - 1, 1);
  }
  
  const pytdStart = subYears(fiscalYearStart, 1);
  const pytdEnd = subYears(asOf, 1);
  
  return {
    ytdStart: fiscalYearStart,
    ytdEnd: asOf,
    pytdStart: pytdStart,
    pytdEnd: pytdEnd
  };
}

export function calculatePeriodMetrics(breakdowns, logs, startDate, endDate, excludeVim = true, walkInData = []) {
  const filteredLogs = logs.filter(log => {
    const logDate = parseLocalDate(log.date);
    const dateMatch = logDate >= startDate && logDate <= endDate;
    // Exclude VIM entries from personal metrics by default, include them when excludeVim is false
    return excludeVim ? (dateMatch && !log.is_vim_entry) : dateMatch;
  });
  
  const logIds = filteredLogs.map(log => log.id);
  const filteredBreakdowns = breakdowns.filter(bd => logIds.includes(bd.daily_log_id));
  const filteredWalkIns = walkInData.filter(wi => logIds.includes(wi.daily_log_id));
  
  let totalNewPatients = 0;
  let totalPaid = 0;
  let totalCollected = 0;
  let totalPotential = 0;
  const payerTotals = {};
  const selfPayMetrics = {
    insurance_found: 0,
    inpatient_financial_assistance: 0,
    walkin_callin_financial_assistance: 0
  };
  const medicareMetrics = {
    qmb_screening: 0,
    qmb_enrollments: 0,
    qmb_paperwork: 0
  };
  const walkInMetrics = {
    totalWalkIns: 0,
    totalPosCount: 0,
    totalPosAmount: 0
  };
  
  // Calculate walk-in metrics
  filteredWalkIns.forEach(wi => {
    walkInMetrics.totalWalkIns += wi.walk_ins || 0;
    walkInMetrics.totalPosCount += wi.pos_collections_count || 0;
    walkInMetrics.totalPosAmount += wi.pos_amount || 0;
    // Add walk-in collections to total collected
    totalCollected += wi.pos_amount || 0;
    totalPaid += wi.pos_collections_count || 0;
  });
  
  filteredBreakdowns.forEach(bd => {
    const newPatients = bd.new_patients || 0;
    totalNewPatients += newPatients;
    totalPaid += bd.pos_collections_count || 0;
    totalCollected += bd.pos_amount || 0;
    totalPotential += bd.pos_potential || 0;
    
    if (!payerTotals[bd.payer_type]) {
      payerTotals[bd.payer_type] = {
        newPatients: 0,
        paid: 0,
        collected: 0,
        potential: 0,
        single: 0,
        multiple: 0,
        insurance_updates: 0
      };
    }
    
    payerTotals[bd.payer_type].newPatients += newPatients;
    payerTotals[bd.payer_type].paid += bd.pos_collections_count || 0;
    payerTotals[bd.payer_type].collected += bd.pos_amount || 0;
    payerTotals[bd.payer_type].potential += bd.pos_potential || 0;
    
    if (bd.payer_type === "Medicare" || bd.payer_type === "Commercial") {
      payerTotals[bd.payer_type].single += bd.single_coverage || 0;
      payerTotals[bd.payer_type].multiple += bd.dual_coverage || 0;
      payerTotals[bd.payer_type].insurance_updates += bd.insurance_updates || 0;
    }
    
    if (bd.payer_type === "Medicare") {
      medicareMetrics.qmb_screening += bd.qmb_screening || 0;
      medicareMetrics.qmb_enrollments += bd.qmb_enrollments || 0;
      medicareMetrics.qmb_paperwork += bd.qmb_paperwork || 0;
    }
    
    if (bd.payer_type === "SelfPay") {
      selfPayMetrics.insurance_found += bd.sp_converted_to_insurance || 0;
      selfPayMetrics.inpatient_financial_assistance += bd.inpatient_financial_assistance || 0;
      selfPayMetrics.walkin_callin_financial_assistance += bd.walkin_callin_financial_assistance || 0;
    }
  });
  
  return {
    totalNewPatients,
    totalPaid,
    totalCollected,
    totalPotential,
    conversionRate: totalNewPatients > 0 ? (totalPaid / totalNewPatients) * 100 : 0,
    payerTotals,
    selfPayMetrics,
    medicareMetrics,
    walkInMetrics
  };
}

export function calculateDelta(ytdValue, pytdValue) {
  const diff = ytdValue - pytdValue;
  const pctChange = pytdValue > 0 ? ((ytdValue - pytdValue) / pytdValue) * 100 : (ytdValue > 0 ? 100 : 0);
  
  return {
    diff,
    pctChange,
    formatted: `${diff >= 0 ? '+' : ''}${diff} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%)`
  };
}
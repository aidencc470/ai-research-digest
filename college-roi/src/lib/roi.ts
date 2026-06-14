// Simplified, illustrative ROI model. Not financial advice.

export const NO_COLLEGE_START_SALARY = 38000;
export const NO_COLLEGE_GROWTH_RATE = 0.02;
export const PROJECTION_YEARS = 30;
export const YEARS_TO_GRADUATE = 4;

export interface ROIInputs {
  annualCOA: number;
  financialAid: number;
  scholarship: number;
  loanRate: number; // e.g. 0.065
  loanTermYears: number; // e.g. 10
  startingSalary: number;
  salaryGrowthRate: number;
  prestigeMultiplier: number;
  years?: number;
}

export interface ROIResult {
  annualNetCost: number;
  totalNetCost: number;
  loanPrincipal: number;
  monthlyLoanPayment: number;
  totalLoanRepayment: number;
  breakEvenYear: number | null;
  collegeNetWorth: number[];
  noCollegeNetWorth: number[];
}

function amortizedAnnualPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  if (years <= 0) return principal;
  if (annualRate === 0) return principal / years;
  const r = annualRate;
  const factor = Math.pow(1 + r, years);
  return (principal * (r * factor)) / (factor - 1);
}

export function computeROI(inputs: ROIInputs): ROIResult {
  const annualNetCost = Math.max(0, inputs.annualCOA - inputs.financialAid - inputs.scholarship);
  const totalNetCost = annualNetCost * YEARS_TO_GRADUATE;
  const loanPrincipal = totalNetCost;
  const annualLoanPayment = amortizedAnnualPayment(loanPrincipal, inputs.loanRate, inputs.loanTermYears);
  const totalLoanRepayment = annualLoanPayment * inputs.loanTermYears;

  const years = inputs.years ?? PROJECTION_YEARS;
  const adjustedStartSalary = inputs.startingSalary * inputs.prestigeMultiplier;

  const collegeNetWorth: number[] = [];
  const noCollegeNetWorth: number[] = [];

  let collegeCum = 0;
  let noCollegeCum = 0;

  for (let y = 0; y <= years; y++) {
    if (y >= YEARS_TO_GRADUATE) {
      const workYear = y - YEARS_TO_GRADUATE;
      const salary = adjustedStartSalary * Math.pow(1 + inputs.salaryGrowthRate, workYear);
      collegeCum += salary;
      if (workYear < inputs.loanTermYears) {
        collegeCum -= annualLoanPayment;
      }
    }

    const noCollegeSalary = NO_COLLEGE_START_SALARY * Math.pow(1 + NO_COLLEGE_GROWTH_RATE, y);
    noCollegeCum += noCollegeSalary;

    collegeNetWorth.push(collegeCum);
    noCollegeNetWorth.push(noCollegeCum);
  }

  let breakEvenYear: number | null = null;
  for (let y = 0; y <= years; y++) {
    if (collegeNetWorth[y] >= noCollegeNetWorth[y]) {
      breakEvenYear = y;
      break;
    }
  }

  return {
    annualNetCost,
    totalNetCost,
    loanPrincipal,
    monthlyLoanPayment: annualLoanPayment / 12,
    totalLoanRepayment,
    breakEvenYear,
    collegeNetWorth,
    noCollegeNetWorth,
  };
}

export function formatCurrency(value: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

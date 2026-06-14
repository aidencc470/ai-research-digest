import { useMemo, useState } from 'react';
import EarningsChart from './EarningsChart';
import { computeROI, formatCurrency, YEARS_TO_GRADUATE } from '../lib/roi';

interface Job {
  title: string;
  share: number;
  startingSalary: number;
  growthRate: number;
}

interface School {
  id: string;
  name: string;
  type: string;
  tuitionInState: number;
  tuitionOutState: number;
  roomBoardOther: number;
  needAidInState: number;
  needAidOutState: number;
  meritAid: number;
  prestigeMultiplier: number;
}

interface Major {
  id: string;
  name: string;
  jobs: Job[];
}

interface Props {
  school: School;
  major: Major;
}

const LOAN_RATE_DEFAULT = 0.065;
const LOAN_TERM_DEFAULT = 10;

export default function ROICalculator({ school, major }: Props) {
  const tuitionDiffers = school.type === 'public' && school.tuitionInState !== school.tuitionOutState;
  const [residency, setResidency] = useState<'in' | 'out'>('in');
  const [financialAid, setFinancialAid] = useState(
    Math.max(school.needAidInState, school.needAidOutState)
  );
  const [scholarship, setScholarship] = useState(school.meritAid);
  const [loanRate, setLoanRate] = useState(LOAN_RATE_DEFAULT);
  const [loanTermYears, setLoanTermYears] = useState(LOAN_TERM_DEFAULT);

  const sortedJobs = useMemo(() => [...major.jobs].sort((a, b) => b.share - a.share), [major.jobs]);
  const [selectedJobTitle, setSelectedJobTitle] = useState(sortedJobs[0]?.title ?? '');
  const selectedJob = sortedJobs.find((j) => j.title === selectedJobTitle) ?? sortedJobs[0];

  const tuition = tuitionDiffers
    ? (residency === 'in' ? school.tuitionInState : school.tuitionOutState)
    : school.tuitionInState;
  const annualCOA = tuition + school.roomBoardOther;

  const maxAid = Math.max(school.needAidInState, school.needAidOutState, 1) * 1.5;

  const result = useMemo(
    () =>
      computeROI({
        annualCOA,
        financialAid,
        scholarship,
        loanRate,
        loanTermYears,
        startingSalary: selectedJob.startingSalary,
        salaryGrowthRate: selectedJob.growthRate,
        prestigeMultiplier: school.prestigeMultiplier,
      }),
    [annualCOA, financialAid, scholarship, loanRate, loanTermYears, selectedJob, school.prestigeMultiplier]
  );

  const breakEvenLabel = (() => {
    if (result.breakEvenYear === null) return "Doesn't break even within 30 years (in this simplified model)";
    const afterGrad = result.breakEvenYear - YEARS_TO_GRADUATE;
    if (afterGrad <= 0) return 'By graduation';
    return `${afterGrad} year${afterGrad === 1 ? '' : 's'} after graduation`;
  })();

  return (
    <div className="roi-calculator">
      <div className="roi-controls">
        <h2>Your numbers</h2>

        {tuitionDiffers && (
          <div className="control">
            <label>Residency</label>
            <div className="toggle-group">
              <button
                type="button"
                className={residency === 'in' ? 'active' : ''}
                onClick={() => setResidency('in')}
              >
                In-state
              </button>
              <button
                type="button"
                className={residency === 'out' ? 'active' : ''}
                onClick={() => setResidency('out')}
              >
                Out-of-state
              </button>
            </div>
          </div>
        )}

        <div className="control">
          <label htmlFor="financial-aid">
            Financial aid (grants, per year) <span className="value">{formatCurrency(financialAid)}</span>
          </label>
          <input
            id="financial-aid"
            type="range"
            min={0}
            max={Math.round(maxAid)}
            step={500}
            value={financialAid}
            onChange={(e) => setFinancialAid(Number(e.target.value))}
          />
        </div>

        <div className="control">
          <label htmlFor="scholarship">
            Scholarship (per year) <span className="value">{formatCurrency(scholarship)}</span>
          </label>
          <input
            id="scholarship"
            type="range"
            min={0}
            max={50000}
            step={500}
            value={scholarship}
            onChange={(e) => setScholarship(Number(e.target.value))}
          />
        </div>

        <div className="control">
          <label htmlFor="loan-rate">
            Loan interest rate <span className="value">{(loanRate * 100).toFixed(2)}%</span>
          </label>
          <input
            id="loan-rate"
            type="range"
            min={0.03}
            max={0.09}
            step={0.0025}
            value={loanRate}
            onChange={(e) => setLoanRate(Number(e.target.value))}
          />
        </div>

        <div className="control">
          <label htmlFor="loan-term">Loan repayment term</label>
          <select id="loan-term" value={loanTermYears} onChange={(e) => setLoanTermYears(Number(e.target.value))}>
            <option value={10}>10 years</option>
            <option value={15}>15 years</option>
            <option value={20}>20 years</option>
          </select>
        </div>

        <div className="control">
          <label htmlFor="job-select">First job after graduation</label>
          <select id="job-select" value={selectedJobTitle} onChange={(e) => setSelectedJobTitle(e.target.value)}>
            {sortedJobs.map((job) => (
              <option key={job.title} value={job.title}>
                {job.title} ({Math.round(job.share * 100)}% of grads, ~{formatCurrency(job.startingSalary, { compact: true })} start)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="roi-results">
        <div className="result-grid">
          <div className="result-box">
            <div className="label">Cost of attendance / yr</div>
            <div className="value">{formatCurrency(annualCOA)}</div>
          </div>
          <div className="result-box">
            <div className="label">Net cost / yr (after aid)</div>
            <div className="value">{formatCurrency(result.annualNetCost)}</div>
          </div>
          <div className="result-box">
            <div className="label">Total 4-year cost</div>
            <div className="value">{formatCurrency(result.totalNetCost)}</div>
          </div>
          <div className="result-box">
            <div className="label">Est. monthly loan payment</div>
            <div className="value">{formatCurrency(result.monthlyLoanPayment)}</div>
          </div>
          <div className="result-box highlight">
            <div className="label">Profit point</div>
            <div className="value">{breakEvenLabel}</div>
          </div>
          <div className="result-box">
            <div className="label">Adjusted starting salary</div>
            <div className="value">
              {formatCurrency(selectedJob.startingSalary * school.prestigeMultiplier, { compact: true })}
            </div>
          </div>
        </div>

        <h3>Lifetime earnings: college vs. no college</h3>
        <p className="chart-caption">
          Cumulative net worth over {result.collegeNetWorth.length - 1} years, starting from when you'd begin
          college (year 0). The blue line is this major's path (earnings minus loan payments); the gray line
          assumes working straight out of high school instead.
        </p>
        <EarningsChart
          collegeNetWorth={result.collegeNetWorth}
          noCollegeNetWorth={result.noCollegeNetWorth}
          breakEvenYear={result.breakEvenYear}
        />
        <div className="legend">
          <span><i className="swatch college" /> {major.name} at {school.name}</span>
          <span><i className="swatch baseline" /> No college (national avg.)</span>
        </div>

        <h3>Common first jobs for {major.name} grads</h3>
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Job title</th>
              <th>% of grads</th>
              <th>Starting salary</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => (
              <tr key={job.title} className={job.title === selectedJobTitle ? 'selected' : ''}>
                <td>{job.title}</td>
                <td>{Math.round(job.share * 100)}%</td>
                <td>{formatCurrency(job.startingSalary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

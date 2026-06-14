interface EarningsChartProps {
  collegeNetWorth: number[];
  noCollegeNetWorth: number[];
  breakEvenYear: number | null;
}

const WIDTH = 680;
const HEIGHT = 340;
const PADDING = { top: 20, right: 20, bottom: 36, left: 76 };

export default function EarningsChart({ collegeNetWorth, noCollegeNetWorth, breakEvenYear }: EarningsChartProps) {
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const years = collegeNetWorth.length - 1;

  const allValues = [...collegeNetWorth, ...noCollegeNetWorth];
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const xScale = (year: number) => (year / years) * innerWidth;
  const yScale = (value: number) => innerHeight - ((value - minVal) / range) * innerHeight;

  const toPath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(2)} ${yScale(v).toFixed(2)}`).join(' ');

  const zeroY = yScale(0);

  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minVal + (range / yTicks) * i);

  const xTickStep = years <= 10 ? 2 : 5;
  const xTickValues = Array.from({ length: Math.floor(years / xTickStep) + 1 }, (_, i) => i * xTickStep);

  const formatTick = (value: number) => {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}k`;
    return `${sign}$${Math.round(abs)}`;
  };

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: '100%', height: 'auto' }}
      role="img"
      aria-label="Cumulative net worth: college vs. no college over time"
    >
      <g transform={`translate(${PADDING.left}, ${PADDING.top})`}>
        {yTickValues.map((tick) => (
          <g key={tick}>
            <line x1={0} y1={yScale(tick)} x2={innerWidth} y2={yScale(tick)} stroke="#edeff5" strokeWidth={1} />
            <text x={-10} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#5b6072">
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {xTickValues.map((year) => (
          <text key={year} x={xScale(year)} y={innerHeight + 20} textAnchor="middle" fontSize="11" fill="#5b6072">
            Yr {year}
          </text>
        ))}

        <line x1={0} y1={zeroY} x2={innerWidth} y2={zeroY} stroke="#b7bcca" strokeWidth={1} />

        {breakEvenYear !== null && (
          <g>
            <line
              x1={xScale(breakEvenYear)}
              y1={0}
              x2={xScale(breakEvenYear)}
              y2={innerHeight}
              stroke="#16a37a"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text x={xScale(breakEvenYear) + 6} y={12} fontSize="11" fill="#16a37a" fontWeight="700">
              Break-even
            </text>
          </g>
        )}

        <path d={toPath(noCollegeNetWorth)} fill="none" stroke="#9aa3b8" strokeWidth={2.5} />
        <path d={toPath(collegeNetWorth)} fill="none" stroke="#2f5fff" strokeWidth={2.5} />
      </g>
    </svg>
  );
}

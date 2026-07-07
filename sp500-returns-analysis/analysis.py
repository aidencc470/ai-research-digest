"""
S&P 500 Financial Metrics vs. Forward 3-Year Returns Analysis
=============================================================
Measures historical statistical association between financial fundamentals
and forward 3-year stock returns. NOT a predictive or investment tool.

Data note: yfinance income_stmt returns the last ~4 fiscal years only.
With a 3-year forward window and data accessed in mid-2026, fiscal years
2022 and earlier qualify (2022 + 3 = 2025, which is fully in the past).

Sections:
  1. Data Collection
  2. Panel Construction
  3. Cleaning & Preprocessing
  4. Modeling
  5. Visualization
  6. Interpretation
"""

import warnings
warnings.filterwarnings("ignore")

import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from scipy.stats.mstats import winsorize

DISCLAIMER = """
=================================================================
DISCLAIMER: This analysis measures historical statistical
association between financial metrics and stock returns.
It is NOT a predictive model and NOT investment advice.
Correlation ≠ causation. Do not make financial decisions
based on these results.
=================================================================
"""
print(DISCLAIMER)


# ═══════════════════════════════════════════════════════════════
# 1. DATA COLLECTION
# ═══════════════════════════════════════════════════════════════
print("── SECTION 1: DATA COLLECTION ──────────────────────────────")

# Pulling from the CURRENT large-cap list introduces SURVIVORSHIP BIAS:
# companies that were delisted, acquired, or failed are excluded.
TICKERS = [
    "AAPL", "MSFT", "AMZN", "GOOGL", "META", "BRK-B", "JPM", "JNJ",
    "XOM", "V", "PG", "UNH", "HD", "MA", "NVDA", "CVX", "PFE", "ABBV",
    "KO", "MRK", "PEP", "BAC", "TMO", "COST", "ABT", "WMT", "LLY",
    "AVGO", "DIS", "ACN", "MCD", "CSCO", "NFLX", "DHR", "NEE", "TXN",
    "ADBE", "QCOM", "UPS", "HON", "AMGN", "PM", "BMY", "RTX", "IBM",
    "SBUX", "GE", "CAT", "MMM", "BA", "GS", "MS", "BLK", "SPGI",
    "AXP", "SCHW", "USB", "WFC", "C", "MET", "PRU", "ALL",
    "COP", "SLB", "OXY", "PSX", "VLO", "MPC",
    "UNP", "CSX", "NSC", "FDX",
    "T", "VZ", "CMCSA",
    "CVS", "CI", "HUM", "ELV", "CNC",
    "LOW", "TGT", "NKE", "EBAY",
    "EMR", "ETN", "ITW", "PH", "ROK",
    "APD", "LIN", "SHW", "PPG", "ECL",
    "AMT", "PLD", "SPG", "O",
]

# yfinance income_stmt only returns ~4 most recent fiscal years.
# Accessed mid-2026, that's roughly 2022–2025 for most companies.
YEARS = list(range(2019, 2026))
FWD_YEARS = 3       # forward return window (3yr so 2022 → 2025 is complete)
MAX_BASE_YEAR = 2022  # base_year + FWD_YEARS must be ≤ 2025
PRICE_END = "2026-07-01"

print(f"  Tickers targeted  : {len(TICKERS)}")
print(f"  Fiscal years range: {YEARS[0]}–{YEARS[-1]} (actual availability depends on yfinance)")
print(f"  Forward return    : {FWD_YEARS} years (base year ≤ {MAX_BASE_YEAR})")
print(f"  Survivorship bias : YES — current large-cap list lookback only\n")

rows = []
failed = []

for ticker in TICKERS:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        income   = t.income_stmt
        balance  = t.balance_sheet
        cashflow = t.cashflow

        if income is None or income.empty:
            failed.append((ticker, "no income statement"))
            continue

        for col in income.columns:
            year = col.year
            if year not in YEARS:
                continue

            row = {"ticker": ticker, "year": year}

            # Revenue growth (YoY)
            try:
                rev_cols = [c for c in income.columns if c.year in [year, year - 1]]
                if len(rev_cols) >= 2:
                    r0 = income.loc["Total Revenue", rev_cols[0]]
                    r1 = income.loc["Total Revenue", rev_cols[1]]
                    row["revenue_growth"] = (r0 - r1) / abs(r1) if r1 else np.nan
                else:
                    row["revenue_growth"] = np.nan
            except Exception:
                row["revenue_growth"] = np.nan

            # Margins
            try:
                rev  = income.loc["Total Revenue", col]
                gp   = income.loc["Gross Profit", col]  if "Gross Profit" in income.index else np.nan
                ebit = income.loc["EBIT", col]           if "EBIT" in income.index else np.nan
                ni   = income.loc["Net Income", col]     if "Net Income" in income.index else np.nan
                row["gross_margin"]     = gp   / rev if (pd.notna(gp)   and rev) else np.nan
                row["operating_margin"] = ebit  / rev if (pd.notna(ebit) and rev) else np.nan
                row["net_margin"]       = ni    / rev if (pd.notna(ni)   and rev) else np.nan
            except Exception:
                row["gross_margin"] = row["operating_margin"] = row["net_margin"] = np.nan

            # Debt-to-equity
            try:
                bc = [c for c in balance.columns if c.year == year]
                if bc:
                    td = balance.loc["Total Debt", bc[0]]          if "Total Debt" in balance.index else np.nan
                    eq = balance.loc["Stockholders Equity", bc[0]] if "Stockholders Equity" in balance.index else np.nan
                    row["debt_to_equity"] = td / eq if (pd.notna(td) and pd.notna(eq) and eq != 0) else np.nan
                else:
                    row["debt_to_equity"] = np.nan
            except Exception:
                row["debt_to_equity"] = np.nan

            # P/E and P/B — from .info (current values, not point-in-time historical)
            row["pe_ratio"] = info.get("trailingPE",  np.nan)
            row["pb_ratio"] = info.get("priceToBook", np.nan)

            # EV/EBITDA (market cap as EV proxy — simplified)
            try:
                ebitda = income.loc["EBITDA", col] if "EBITDA" in income.index else np.nan
                mc = info.get("marketCap", np.nan)
                row["ev_ebitda"] = mc / ebitda if (pd.notna(mc) and pd.notna(ebitda) and ebitda > 0) else np.nan
            except Exception:
                row["ev_ebitda"] = np.nan

            # Free cash flow yield
            try:
                cc = [c for c in cashflow.columns if c.year == year]
                if cc:
                    fcf = cashflow.loc["Free Cash Flow", cc[0]] if "Free Cash Flow" in cashflow.index else np.nan
                    mc  = info.get("marketCap", np.nan)
                    row["fcf_yield"] = fcf / mc if (pd.notna(fcf) and pd.notna(mc) and mc > 0) else np.nan
                else:
                    row["fcf_yield"] = np.nan
            except Exception:
                row["fcf_yield"] = np.nan

            # ROIC = NOPAT / invested capital (equity + debt)
            try:
                ebit_val = income.loc["EBIT", col] if "EBIT" in income.index else np.nan
                nopat = ebit_val * (1 - 0.21) if pd.notna(ebit_val) else np.nan
                bc2 = [c for c in balance.columns if c.year == year]
                if bc2 and pd.notna(nopat):
                    te  = balance.loc["Stockholders Equity", bc2[0]] if "Stockholders Equity" in balance.index else 0
                    td2 = balance.loc["Total Debt", bc2[0]]          if "Total Debt" in balance.index else 0
                    ic  = (te or 0) + (td2 or 0)
                    row["roic"] = nopat / ic if ic > 0 else np.nan
                else:
                    row["roic"] = np.nan
            except Exception:
                row["roic"] = np.nan

            rows.append(row)

    except Exception as e:
        failed.append((ticker, str(e)))

panel_raw = pd.DataFrame(rows)
print(f"  Raw panel shape : {panel_raw.shape}")
print(f"  Tickers failed  : {len(failed)}")
if failed:
    print(f"  Failed tickers  : {[t for t, _ in failed[:10]]}{'...' if len(failed) > 10 else ''}")
print()


# ═══════════════════════════════════════════════════════════════
# 2. PANEL CONSTRUCTION — forward 3-year price returns
# ═══════════════════════════════════════════════════════════════
print("── SECTION 2: PANEL CONSTRUCTION ───────────────────────────")

price_cache = {}
print("  Downloading price history...")
for ticker in panel_raw["ticker"].unique():
    try:
        hist = yf.download(ticker, start="2019-01-01", end=PRICE_END,
                           progress=False, auto_adjust=True)
        if not hist.empty:
            hist.index = pd.to_datetime(hist.index)
            price_cache[ticker] = hist["Close"]
    except Exception:
        pass

def get_year_end_price(ticker, year):
    if ticker not in price_cache:
        return np.nan
    s = price_cache[ticker]
    yr = s[s.index.year == year]
    return float(yr.iloc[-1]) if not yr.empty else np.nan

def fwd_return(ticker, base_year, n_years=FWD_YEARS):
    p0 = get_year_end_price(ticker, base_year)
    p1 = get_year_end_price(ticker, base_year + n_years)
    if pd.isna(p0) or pd.isna(p1) or p0 <= 0:
        return np.nan
    return (p1 - p0) / p0

print(f"  Computing forward {FWD_YEARS}-year returns...")
panel_raw["fwd_return"] = panel_raw.apply(
    lambda r: fwd_return(r["ticker"], r["year"]), axis=1
)

# Only base years where base_year + FWD_YEARS is fully in the past
panel_raw["valid_window"] = panel_raw["year"] <= MAX_BASE_YEAR

panel_valid = panel_raw[
    panel_raw["valid_window"] & panel_raw["fwd_return"].notna()
].copy()

print(f"  Rows before filter : {len(panel_raw)}")
print(f"  Rows after filter  : {len(panel_valid)}")
if not panel_valid.empty:
    print(f"  Fiscal years used  : {sorted(panel_valid['year'].unique())}")
print()


# ═══════════════════════════════════════════════════════════════
# 3. CLEANING & PREPROCESSING
# ═══════════════════════════════════════════════════════════════
print("── SECTION 3: CLEANING & PREPROCESSING ─────────────────────")

FEATURE_COLS = [
    "roic", "revenue_growth", "gross_margin", "operating_margin",
    "net_margin", "debt_to_equity", "pe_ratio", "pb_ratio",
    "ev_ebitda", "fcf_yield",
]
TARGET_COL = "fwd_return"

if panel_valid.empty:
    print("  ERROR: No valid rows after forward-return filter.")
    print("  Check yfinance data availability and year/window settings.")
    raise SystemExit(1)

miss = panel_valid[FEATURE_COLS].isna().sum()
n_rows = len(panel_valid)

print("  Missing values per feature (before imputation):")
for col, n in miss.items():
    pct = 100 * n / n_rows
    print(f"    {col:<22} {n:>4} ({pct:.1f}%)")

# Drop features with ≥50% missing; median-impute the rest
drop_cols = [c for c in FEATURE_COLS if miss[c] / n_rows >= 0.50]
keep_cols  = [c for c in FEATURE_COLS if c not in drop_cols]

if drop_cols:
    print(f"\n  Dropped (≥50% missing): {drop_cols}")

for col in keep_cols:
    panel_valid[col] = panel_valid[col].fillna(panel_valid[col].median())

# Winsorize at 2.5/97.5 to dampen extreme ratios (negative P/E, etc.)
for col in keep_cols:
    panel_valid[col] = winsorize(panel_valid[col].values, limits=[0.025, 0.025])

# Z-score standardize
scaler = StandardScaler()
panel_valid[keep_cols] = scaler.fit_transform(panel_valid[keep_cols])

panel_model = panel_valid[keep_cols + [TARGET_COL]].dropna()

print(f"\n  Features in model : {keep_cols}")
print(f"  Final model rows  : {len(panel_model)}")
print(f"\n  Panel sample (first 5 rows):")
print(panel_valid[["ticker", "year"] + keep_cols[:4] + [TARGET_COL]].head().to_string(index=False))
print()


# ═══════════════════════════════════════════════════════════════
# 4. MODELING
# ═══════════════════════════════════════════════════════════════
print("── SECTION 4: MODELING ──────────────────────────────────────")
# Coefficients = historical correlation, NOT causation.
# No out-of-sample validation. NOT a predictive tool.

X = panel_model[keep_cols].values
y = panel_model[TARGET_COL].values

model = LinearRegression()
model.fit(X, y)

r2 = model.score(X, y)
n, p = X.shape
adj_r2 = 1 - (1 - r2) * (n - 1) / max(n - p - 1, 1)

coef_df = pd.DataFrame({
    "feature":     keep_cols,
    "coefficient": model.coef_,
    "abs_coef":    np.abs(model.coef_),
}).sort_values("abs_coef", ascending=False).reset_index(drop=True)

print(f"  R²          : {r2:.4f}")
print(f"  Adjusted R² : {adj_r2:.4f}")
print(f"  Intercept   : {model.intercept_:.4f}")
print(f"  Observations: {n}  |  Features: {p}")
print(f"\n  Coefficient table (sorted by |coef|):")
print(coef_df[["feature", "coefficient", "abs_coef"]].to_string(index=False))
print()


# ═══════════════════════════════════════════════════════════════
# 5. VISUALIZATION
# ═══════════════════════════════════════════════════════════════
print("── SECTION 5: VISUALIZATION ─────────────────────────────────")

fig, axes = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle(
    f"S&P 500: Financial Metrics vs. Forward {FWD_YEARS}-Year Returns\n"
    "Historical Association Only — Not a Predictive Model",
    fontsize=13, fontweight="bold"
)

# Feature importance bar chart
colors = ["#2ecc71" if c >= 0 else "#e74c3c" for c in coef_df["coefficient"]]
axes[0].barh(coef_df["feature"][::-1], coef_df["abs_coef"][::-1], color=colors[::-1])
axes[0].set_xlabel("Absolute Coefficient (standardized)")
axes[0].set_title("Feature Importance by |Coefficient|\nGreen = positive association, Red = negative")

# Actual vs. predicted scatter
y_pred = model.predict(X)
axes[1].scatter(y, y_pred, alpha=0.5, s=25, color="#3498db", edgecolors="white", linewidths=0.3)
lims = [min(y.min(), y_pred.min()) * 0.95, max(y.max(), y_pred.max()) * 1.05]
axes[1].plot(lims, lims, "r--", linewidth=1, label="Perfect fit")
axes[1].set_xlabel(f"Actual {FWD_YEARS}-yr Return")
axes[1].set_ylabel(f"Predicted {FWD_YEARS}-yr Return")
axes[1].set_title(f"Actual vs. Predicted\nR² = {r2:.3f}  |  Adj R² = {adj_r2:.3f}")
axes[1].xaxis.set_major_formatter(mtick.PercentFormatter(1.0))
axes[1].yaxis.set_major_formatter(mtick.PercentFormatter(1.0))
axes[1].legend()

plt.tight_layout()
out_path = "sp500_metrics_analysis.png"
plt.savefig(out_path, dpi=150, bbox_inches="tight")
print(f"  Chart saved → {out_path}")
print()


# ═══════════════════════════════════════════════════════════════
# 6. INTERPRETATION
# ═══════════════════════════════════════════════════════════════
print("── SECTION 6: INTERPRETATION ────────────────────────────────")

print("  Top associated metrics:\n")
for _, row in coef_df.head(5).iterrows():
    direction = "positively" if row["coefficient"] > 0 else "negatively"
    print(f"  • {row['feature']:<22} coef = {row['coefficient']:+.3f}  ({direction} associated)")

print(f"""
  PLAIN-LANGUAGE SUMMARY
  ──────────────────────
  Using {n} company-year observations and {p} standardized financial
  metrics, this model explains {r2*100:.1f}% of the variance in forward
  {FWD_YEARS}-year stock returns (adjusted R² = {adj_r2*100:.1f}%).

  The metrics ranked highest by coefficient magnitude had the strongest
  historical statistical link to subsequent returns in this dataset.
  However, the low R² signals that most return variation is driven by
  factors not captured here — consistent with efficient market theory.

  DATA NOTE
  ─────────
  yfinance income_stmt provides only the most recent ~4 fiscal years.
  This analysis uses fiscal years {sorted(panel_valid['year'].unique()) if not panel_valid.empty else 'N/A'}.
  A longer historical panel would require a paid data source (e.g.,
  Compustat, FactSet) or a downloadable Kaggle fundamentals dataset.

  LIMITATIONS
  ───────────
  1. Survivorship bias — failed/delisted companies are excluded,
     which likely overstates average historical returns.
  2. Correlation ≠ causation — coefficients reflect co-movement,
     not a causal relationship.
  3. P/E and P/B reflect current yfinance .info values, not true
     point-in-time historical prices at each fiscal year-end.
  4. Small sample relative to features — risk of overfitting;
     no out-of-sample validation performed.
  5. Returns are raw (not risk- or market-adjusted).
  6. NOT an investment tool. Do not act on these results.
""")

print("=" * 65)
print("Analysis complete.")
print("=" * 65)

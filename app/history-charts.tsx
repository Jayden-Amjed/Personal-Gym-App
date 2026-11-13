"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Activity, ChevronLeft, ChevronRight, Flame, Scale } from "lucide-react";
import { buildHistorySeries, shiftHistoryPeriod, type HistoryMetric, type HistoryPoint, type HistoryRange, type HistorySeries } from "../lib/history-charts";
import type { State } from "../lib/model";

const METRICS = {
  weight: { title: "Body weight", subtitle: "Your weigh-ins over time", icon: Scale, empty: "No weigh-ins in this period", hint: "Log your body weight from Overview, or choose another period." },
  calories: { title: "Daily calories", subtitle: "A record of the food you log", icon: Flame, empty: "No food logged in this period", hint: "Add food from Nutrition, or choose another period." },
  reps: { title: "Reps, day by day", subtitle: "Every logged set adds up", icon: Activity, empty: "No reps logged in this period", hint: "Log sets in a workout, or choose another period." },
} as const;
const RANGES: { value: HistoryRange; label: string }[] = [{ value: "month", label: "Month" }, { value: "year", label: "Year" }, { value: "all", label: "All time" }];
const formatNumber = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const formatAxis = (value: number) => value.toLocaleString("en-US", { notation: Math.abs(value) >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 });
function axisStep(span: number, wholeNumbers: boolean) {
  const approximate = Math.max(span / 4, .01);
  const magnitude = 10 ** Math.floor(Math.log10(approximate));
  const fraction = approximate / magnitude;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
  return wholeNumbers ? Math.max(1, Math.ceil(step)) : step;
}

function HistoryGraph({ series, metric, title }: { series: HistorySeries; metric: HistoryMetric; title: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const id = useId().replaceAll(":", "");
  const points = series.points;
  const EmptyIcon = METRICS[metric].icon;
  const logged = points.filter((point): point is HistoryPoint & { value: number } => point.value !== null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(240, Math.floor(element.getBoundingClientRect().width)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = width < 500 ? 290 : 340;
  const left = width < 500 ? 43 : 55, right = 14, top = 22, bottom = height - 37;
  const plotWidth = width - left - right;
  const maximum = logged.reduce((max, point) => Math.max(max, point.value), 0);
  const minimum = logged.reduce((min, point) => Math.min(min, point.value), maximum);
  const padding = metric === "weight" ? Math.max(2, (maximum - minimum) * .18) : Math.max(1, maximum * .14);
  const rawLower = metric === "weight" ? Math.max(0, minimum - padding) : 0;
  const step = axisStep(maximum + padding - rawLower, metric !== "weight");
  const lower = Math.floor(rawLower / step) * step;
  const upper = Math.max(lower + step, Math.ceil((maximum + padding) / step) * step);
  const axisTicks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => lower + index * step);
  const x = (index: number) => left + plotWidth * (index + .5) / Math.max(points.length, 1);
  const y = (value: number) => bottom - (value - lower) / (upper - lower) * (bottom - top);
  const defaultIndex = points.findLastIndex(point => point.value !== null);
  const selectedIndex = activeIndex !== null && activeIndex < points.length ? activeIndex : defaultIndex;
  const selected = points[selectedIndex];
  const tickCount = width < 500 ? 4 : 6;
  const tickIndices = [...new Set(Array.from({ length: Math.min(tickCount, points.length) }, (_, i) => Math.round(i * (points.length - 1) / Math.max(1, Math.min(tickCount, points.length) - 1))))];
  const segments: { x: number; y: number }[][] = [];
  points.forEach((point, index) => {
    if (point.value === null) return;
    if (index === 0 || points[index - 1].value === null) segments.push([]);
    segments[segments.length - 1].push({ x: x(index), y: y(point.value) });
  });

  function pointAt(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width * width;
    setActiveIndex(Math.max(0, Math.min(points.length - 1, Math.floor((position - left) / plotWidth * points.length))));
  }
  function movePoint(event: KeyboardEvent<SVGSVGElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = selectedIndex < 0 ? 0 : selectedIndex;
    setActiveIndex(event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1))));
  }

  return <div ref={container} className="history-graph">
    {logged.length ? <>
      <div className="history-point-detail" id={`${id}-detail`} aria-live="polite" aria-atomic="true">
        <span>{selected?.detailLabel ?? series.periodLabel}</span>
        <strong>{selected?.value === null || !selected ? "Not logged" : <>{formatNumber(selected.value)} <small>{series.unit}</small></>}</strong>
        {selected && series.grain !== "day" && selected.value !== null && <small>{selected.count} logged {selected.count === 1 ? "day" : "days"}</small>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" tabIndex={0} aria-label={`${title}, ${series.periodLabel}. ${series.description}`} aria-describedby={`${id}-instructions ${id}-detail`} onPointerMove={pointAt} onPointerDown={pointAt} onPointerLeave={event => { if (event.pointerType === "mouse") setActiveIndex(null); }} onKeyDown={movePoint}>
        <defs><linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ff742d" stopOpacity=".2" /><stop offset="100%" stopColor="#ff742d" stopOpacity="0" /></linearGradient></defs>
        <g aria-hidden="true">
          {axisTicks.map((value, i) => {
            return <g key={i}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#34302d" strokeDasharray={i ? "3 5" : undefined} /><text x={left - 10} y={y(value) + 4} textAnchor="end" fill="#aaa19a" fontSize="11">{formatAxis(value)}</text></g>;
          })}
          {metric === "weight" ? <>
            {segments.map((segment, index) => <g key={index}>
              {segment.length > 1 && <path d={`M ${segment[0].x},${bottom} L ${segment.map(point => `${point.x},${point.y}`).join(" L ")} L ${segment[segment.length - 1].x},${bottom} Z`} fill={`url(#${id}-area)`} />}
              <path d={`M ${segment.map(point => `${point.x},${point.y}`).join(" L ")}`} fill="none" stroke="#ff873e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            </g>)}
            {points.map((point, index) => point.value !== null && <circle key={point.date} cx={x(index)} cy={y(point.value)} r={points.length > 50 ? 2.5 : 3.5} fill="#ff873e" stroke="#1c1917" strokeWidth="1.5" />)}
          </> : points.map((point, index) => point.value !== null && <rect key={point.date} x={x(index) - Math.max(1.5, Math.min(33, plotWidth / points.length * .65)) / 2} y={Math.min(bottom - 2, y(point.value))} width={Math.max(1.5, Math.min(33, plotWidth / points.length * .65))} height={Math.max(2, bottom - y(point.value))} rx={points.length > 50 ? 1 : 3} fill={index === selectedIndex ? "#ff873e" : "#a45129"} />)}
          {selected && <g><line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top} y2={bottom} stroke="#dca27e" strokeOpacity=".5" strokeDasharray="3 5" />{selected.value !== null && metric === "weight" && <circle cx={x(selectedIndex)} cy={y(selected.value)} r="5" fill="#ff873e" stroke="#ffdac1" strokeWidth="2" />}</g>}
          {tickIndices.map(index => <text key={index} x={x(index)} y={height - 12} textAnchor={points.length === 1 ? "middle" : index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fill="#aaa19a" fontSize="11">{points[index].label}</text>)}
        </g>
      </svg>
      <p className="history-chart-instructions" id={`${id}-instructions`}>Tap or hover for details. Use arrow keys when the chart is focused.</p>
      <details className="history-chart-data"><summary>View chart data</summary><div className="history-chart-table-wrap" tabIndex={0} role="region" aria-label={`${title} data table`}><table><caption>{series.periodLabel} · {series.description}</caption><thead><tr><th scope="col">{series.grain === "day" ? "Date" : series.grain === "month" ? "Month" : "Year"}</th><th scope="col">{series.unit}</th>{series.grain !== "day" && <th scope="col">Logged days</th>}</tr></thead><tbody>{points.map(point => <tr key={point.date}><th scope="row">{point.detailLabel}</th><td>{point.value === null ? "Not logged" : formatNumber(point.value)}</td>{series.grain !== "day" && <td>{point.count}</td>}</tr>)}</tbody></table></div></details>
    </> : <div className="history-chart-empty" style={{ minHeight: height }}><span className="history-empty-symbol"><EmptyIcon size={24} /></span><h4>{METRICS[metric].empty}</h4><p>{METRICS[metric].hint}</p><span>Unlogged dates stay empty.</span></div>}
  </div>;
}

function HistoryChartCard({ data, today, metric }: { data: State; today: string; metric: HistoryMetric }) {
  const [range, setRange] = useState<HistoryRange>("month");
  const [anchor, setAnchor] = useState(today);
  const [monthInput, setMonthInput] = useState(today.slice(0, 7));
  const [yearInput, setYearInput] = useState(today.slice(0, 4));
  const id = useId();
  const config = METRICS[metric];
  const series = useMemo(() => buildHistorySeries(data, metric, range, anchor, today), [data, metric, range, anchor, today]);
  const validYear = /^\d{1,4}$/.test(yearInput) && Number(yearInput) >= 1 && Number(yearInput) <= Number(today.slice(0, 4));
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthInput) && Number(monthInput.slice(0, 4)) > 0 && monthInput <= today.slice(0, 7);
  function chooseAnchor(value: string) {
    const bounded = value > today ? today : value;
    setAnchor(bounded);
    setMonthInput(bounded.slice(0, 7));
    setYearInput(bounded.slice(0, 4));
  }
  function commitMonth(value: string) {
    setMonthInput(value);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) > 0 && value <= today.slice(0, 7)) chooseAnchor(`${value}-01`);
  }
  function commitYear() {
    if (validYear) chooseAnchor(`${yearInput.padStart(4, "0")}-01-01`);
  }
  return <section className="panel history-chart-card" aria-labelledby={`${id}-heading`}>
    <div className="history-chart-heading"><div className="history-chart-title"><span className="history-chart-icon"><config.icon size={20} /></span><div><h3 id={`${id}-heading`}>{config.title}</h3><p>{config.subtitle}</p></div></div><div className="history-range" role="group" aria-label={`${config.title} time range`}>{RANGES.map(option => <button type="button" key={option.value} aria-pressed={range === option.value} className={range === option.value ? "selected" : ""} onClick={() => { setRange(option.value); setMonthInput(anchor.slice(0, 7)); setYearInput(anchor.slice(0, 4)); }}>{option.label}</button>)}</div></div>
    <div className="history-chart-period"><span>{series.periodLabel}</span>{range !== "all" && <div className="history-period-controls"><button type="button" className="history-period-arrow" aria-label={`Previous ${range} for ${config.title}`} disabled={!series.canPrevious} onClick={() => chooseAnchor(shiftHistoryPeriod(anchor, range, -1))}><ChevronLeft size={18} /></button>{range === "month" ? <input type="month" aria-label={`${config.title} month`} value={monthInput} min="0001-01" max={today.slice(0, 7)} aria-invalid={!validMonth} onChange={event => commitMonth(event.target.value)} onBlur={event => commitMonth(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter") commitMonth(event.currentTarget.value); }} /> : <input type="number" aria-label={`${config.title} year`} value={yearInput} min="1" max={Number(today.slice(0, 4))} step="1" inputMode="numeric" aria-invalid={!validYear} onChange={event => { setYearInput(event.target.value); if (/^\d{4}$/.test(event.target.value) && Number(event.target.value) >= 1 && Number(event.target.value) <= Number(today.slice(0, 4))) chooseAnchor(`${event.target.value}-01-01`); }} onBlur={commitYear} onKeyDown={event => { if (event.key === "Enter") commitYear(); }} /> }<button type="button" className="history-period-arrow" aria-label={`Next ${range} for ${config.title}`} disabled={!series.canNext} onClick={() => chooseAnchor(shiftHistoryPeriod(anchor, range, 1))}><ChevronRight size={18} /></button></div>}</div>
    {((range === "month" && !validMonth) || (range === "year" && !validYear)) && <p className="history-period-error" role="alert">Choose a valid {range} through {range === "month" ? today.slice(0, 7) : today.slice(0, 4)}. The chart still shows {series.periodLabel}.</p>}
    <div className="history-chart-summary"><div><p>{series.summaryLabel}</p><strong>{series.summaryValue === null ? "—" : formatNumber(series.summaryValue)}<span>{series.unit}</span></strong></div><div className="history-chart-context">{series.change !== null && <span className="history-chart-change">{series.change > 0 ? "+" : ""}{formatNumber(series.change)} lb in period</span>}<span>{series.loggedDays} logged {series.loggedDays === 1 ? "day" : "days"}</span></div></div>
    <p className="history-chart-description">{series.description}</p>
    <HistoryGraph key={`${range}-${series.start}-${series.end}-${series.grain}`} series={series} metric={metric} title={config.title} />
  </section>;
}

export default function HistoryCharts({ data, today }: { data: State; today: string }) {
  return <div className="history-charts">{(["weight", "calories", "reps"] as const).map(metric => <HistoryChartCard key={metric} data={data} today={today} metric={metric} />)}</div>;
}

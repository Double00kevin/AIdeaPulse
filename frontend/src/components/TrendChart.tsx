interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}

export default function TrendChart({
  data,
  width = 300,
  height = 100,
  color = "#22d3ee",
  showArea = true,
}: Props) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-gray-600 text-xs"
        style={{ width, height }}
      >
        Not enough data
      </div>
    );
  }

  const padding = { top: 8, right: 8, bottom: 20, left: 8 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const areaPath = showArea
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`
    : "";

  // Show a few date labels
  const labelIndices = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padding.top + chartHeight * (1 - frac);
        return (
          <line
            key={frac}
            x1={padding.left}
            y1={y}
            x2={padding.left + chartWidth}
            y2={y}
            stroke="#1f2937"
            strokeWidth={1}
          />
        );
      })}

      {/* Area fill */}
      {showArea && (
        <path d={areaPath} fill={color} opacity={0.1} />
      )}

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Date labels */}
      {labelIndices.map((idx) => {
        const p = points[idx];
        if (!p) return null;
        const label = p.date.slice(5); // MM-DD
        return (
          <text
            key={idx}
            x={p.x}
            y={padding.top + chartHeight + 14}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={9}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

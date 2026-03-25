import { useState } from "react";
import { cn } from "@/lib/utils";
interface DirectionCompassProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}
const DIRECTIONS = [{
  value: "Bắc",
  angle: 0,
  label: "Bắc"
}, {
  value: "Đông Bắc",
  angle: 45,
  label: "Đông Bắc"
}, {
  value: "Đông",
  angle: 90,
  label: "Đông"
}, {
  value: "Đông Nam",
  angle: 135,
  label: "Đông Nam"
}, {
  value: "Nam",
  angle: 180,
  label: "Nam"
}, {
  value: "Tây Nam",
  angle: 225,
  label: "Tây Nam"
}, {
  value: "Tây",
  angle: 270,
  label: "Tây"
}, {
  value: "Tây Bắc",
  angle: 315,
  label: "Tây Bắc"
}];
export const DirectionCompass = ({
  value,
  onChange,
  label
}: DirectionCompassProps) => {
  const [hoveredDirection, setHoveredDirection] = useState<string | null>(null);
  const getSegmentPath = (startAngle: number, endAngle: number, innerRadius: number, outerRadius: number) => {
    const startAngleRad = (startAngle - 90) * Math.PI / 180;
    const endAngleRad = (endAngle - 90) * Math.PI / 180;
    const x1 = 200 + outerRadius * Math.cos(startAngleRad);
    const y1 = 200 + outerRadius * Math.sin(startAngleRad);
    const x2 = 200 + outerRadius * Math.cos(endAngleRad);
    const y2 = 200 + outerRadius * Math.sin(endAngleRad);
    const x3 = 200 + innerRadius * Math.cos(endAngleRad);
    const y3 = 200 + innerRadius * Math.sin(endAngleRad);
    const x4 = 200 + innerRadius * Math.cos(startAngleRad);
    const y4 = 200 + innerRadius * Math.sin(startAngleRad);
    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`;
  };
  const getLabelPosition = (angle: number, radius: number) => {
    const angleRad = (angle - 90) * Math.PI / 180;
    const x = 200 + radius * Math.cos(angleRad);
    const y = 200 + radius * Math.sin(angleRad);
    return {
      x,
      y
    };
  };
  return <div className="space-y-4">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex justify-center">
        <svg width="400" height="400" viewBox="0 0 400 400" className="max-w-full">
          {/* Vẽ các phân đoạn */}
          {DIRECTIONS.map((direction, index) => {
          const startAngle = direction.angle - 22.5;
          const endAngle = direction.angle + 22.5;
          const isSelected = value === direction.value;
          const isHovered = hoveredDirection === direction.value;
          return <g key={direction.value}>
                <path d={getSegmentPath(startAngle, endAngle, 80, 180)} className={cn("cursor-pointer transition-all duration-200", isSelected ? "fill-gray-900 stroke-gray-800" : isHovered ? "fill-gray-600 stroke-gray-500" : "fill-muted/40 stroke-muted-foreground/20")} strokeWidth="2" onClick={() => onChange(direction.value)} onMouseEnter={() => setHoveredDirection(direction.value)} onMouseLeave={() => setHoveredDirection(null)} />
              </g>;
        })}

          {/* Vẽ nhãn */}
          {DIRECTIONS.map(direction => {
          const labelPos = getLabelPosition(direction.angle, 130);
          const isSelected = value === direction.value;
          const isHovered = hoveredDirection === direction.value;
          return <text key={`label-${direction.value}`} x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle" className={cn("text-sm font-medium pointer-events-none select-none transition-colors", isSelected ? "fill-white font-bold" : isHovered ? "fill-white font-semibold" : "fill-foreground")}>
                {direction.label}
              </text>;
        })}

          {/* Vòng tròn giữa */}
          <circle cx="200" cy="200" r="80" className="fill-background stroke-border" strokeWidth="2" />

          {/* Hiển thị hướng đã chọn ở giữa */}
          {value && <text x="200" y="200" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold fill-foreground">
              {value}
            </text>}
        </svg>
      </div>
    </div>;
};
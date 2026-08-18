import React, { useEffect, useState, useRef } from "react";
import { usePortfolio } from "../context/context";

function AnimatedMetricValue({ value }: { value: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const containerRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Check if value has numbers to animate
    let targetNum: number | null = null;
    let decimals = 0;
    let prefix = "";
    let suffix = "";

    if (value.includes("3.53")) {
      targetNum = 3.53;
      decimals = 2;
      suffix = " / 4.00";
    } else if (value.includes("300") || value.includes("210")) {
      targetNum = 300;
      decimals = 0;
      suffix = "+ Hrs";
    } else if (value.includes("5") || value.includes("10")) {
      targetNum = 5;
      decimals = 0;
      suffix = "+ Endpoints";
    }

    if (targetNum === null) {
      setDisplayValue(value);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1600;
          const startTime = performance.now();

          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = (targetNum as number) * ease;
            const formatted = decimals > 0 ? current.toFixed(decimals) : Math.floor(current).toString();
            setDisplayValue(`${prefix}${formatted}${suffix}`);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              const finalVal = decimals > 0 ? (targetNum as number).toFixed(decimals) : (targetNum as number).toString();
              setDisplayValue(`${prefix}${finalVal}${suffix}`);
            }
          };

          requestAnimationFrame(animate);
        }
      });
    }, { threshold: 0.15 });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={containerRef} className="font-outfit text-2xl sm:text-3xl font-extrabold text-primary mb-1">
      {displayValue}
    </span>
  );
}

export default function MetricsBar() {
  const { data } = usePortfolio();

  return (
    <section className="relative z-10 -mt-6 sm:-mt-10 mb-12 sm:mb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-base-300 rounded-3xl overflow-hidden border border-base-300 shadow-xl">
          {data.metrics.map((metric, idx) => (
            <div
              key={idx}
              className="bg-base-100 p-5 sm:p-6 flex flex-col items-center text-center hover:bg-base-200/60 transition-colors"
            >
              <AnimatedMetricValue value={metric.value} />
              <span className="font-outfit text-sm font-bold text-base-content mb-0.5">
                {metric.label}
              </span>
              <span className="font-sans text-xs text-base-content/60">
                {metric.sublabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

/*
 * Series colors come from the validated data-viz palette (colorblind-safe in both modes against the card
 * surfaces), not from the switchable accent, so a chart reads the same whichever accent is chosen.
 * Light-mode aqua and yellow sit below 3:1 on white, so every chart also has a table view.
 */

const signInConfig = {
  succeeded: { label: 'Succeeded', theme: { light: '#2a78d6', dark: '#3987e5' } },
  failed: { label: 'Failed', theme: { light: '#d03b3b', dark: '#d03b3b' } },
} satisfies ChartConfig;

const changeConfig = {
  granted: { label: 'Access granted', theme: { light: '#2a78d6', dark: '#3987e5' } },
  revoked: { label: 'Access removed', theme: { light: '#eb6834', dark: '#d95926' } },
  changed: { label: 'Other changes', theme: { light: '#1baf7a', dark: '#199e70' } },
  security: { label: 'Security', theme: { light: '#eda100', dark: '#c98500' } },
} satisfies ChartConfig;

const dayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const label = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`));
const longLabel = (date: string) => dayLong.format(new Date(`${date}T00:00:00Z`));

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: Record<string, unknown>;
}

/**
 * One segment of a stacked column: only the column's top (its data end) is rounded, it stays square at the
 * baseline, and a 2px gap of card surface separates it from the segment below.
 */
function stackSegment(key: string, order: readonly string[]) {
  return function Segment(props: unknown) {
    const { x = 0, y = 0, width = 0, height = 0, fill, payload } = props as SegmentProps;
    if (width <= 0 || height <= 0) return <g />;

    const present = order.filter((k) => Number(payload?.[k] ?? 0) > 0);
    const isTop = present[present.length - 1] === key;
    const isBottom = present[0] === key;
    const h = isBottom ? height : Math.max(height - 2, 1);
    const r = isTop ? Math.min(4, width / 2, h) : 0;
    const d =
      r > 0
        ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`
        : `M${x},${y} H${x + width} V${y + h} H${x} Z`;
    return <path d={d} fill={fill} />;
  };
}

const signInOrder = ['succeeded', 'failed'] as const;
const changeOrder = ['granted', 'revoked', 'changed', 'security'] as const;
const signInShapes = Object.fromEntries(signInOrder.map((key) => [key, stackSegment(key, signInOrder)]));
const changeShapes = Object.fromEntries(changeOrder.map((key) => [key, stackSegment(key, changeOrder)]));

function Axes() {
  return (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
      <XAxis dataKey="date" tickFormatter={label} tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tickMargin={4} />
    </>
  );
}

export function SignInsChart({ data }: { data: { date: string; succeeded: number; failed: number }[] }) {
  return (
    <ChartContainer config={signInConfig} className="aspect-auto h-64 w-full" aria-label="Sign-ins per day, succeeded and failed">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%" accessibilityLayer>
        <Axes />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          itemSorter={(item) => signInOrder.indexOf(String(item.dataKey) as (typeof signInOrder)[number])}
          content={<ChartTooltipContent labelFormatter={(_, items) => longLabel(String(items?.[0]?.payload?.date ?? ''))} />}
        />
        <ChartLegend verticalAlign="top" align="right" itemSorter={null} content={<ChartLegendContent verticalAlign="top" className="justify-end" />} />
        {signInOrder.map((key) => (
          <Bar key={key} dataKey={key} stackId="signins" fill={`var(--color-${key})`} maxBarSize={24} shape={signInShapes[key]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export function ChangesChart({
  data,
}: {
  data: { date: string; granted: number; revoked: number; changed: number; security: number }[];
}) {
  return (
    <ChartContainer config={changeConfig} className="aspect-auto h-64 w-full" aria-label="Audit events per day, by kind of change">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%" accessibilityLayer>
        <Axes />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          itemSorter={(item) => changeOrder.indexOf(String(item.dataKey) as (typeof changeOrder)[number])}
          content={<ChartTooltipContent labelFormatter={(_, items) => longLabel(String(items?.[0]?.payload?.date ?? ''))} />}
        />
        <ChartLegend verticalAlign="top" align="right" itemSorter={null} content={<ChartLegendContent verticalAlign="top" className="flex-wrap justify-end gap-x-4 gap-y-1" />} />
        {changeOrder.map((key) => (
          <Bar key={key} dataKey={key} stackId="changes" fill={`var(--color-${key})`} maxBarSize={24} shape={changeShapes[key]} isAnimationActive={false} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

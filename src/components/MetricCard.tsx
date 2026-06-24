type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
};

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 font-['Chakra_Petch'] text-3xl font-semibold text-zinc-50">
        {value}
      </p>
      <p className="mt-2 text-xs text-zinc-400">{hint}</p>
    </div>
  );
}

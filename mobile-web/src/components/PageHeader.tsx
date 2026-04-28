interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <h1 className="font-bold text-stone-800 text-lg leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

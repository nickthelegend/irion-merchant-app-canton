export default function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-8 max-w-6xl mx-auto font-display">
      <h1 className="text-2xl font-black tracking-tight">{title}</h1>
      <p className="text-sm text-white/40 mt-1">{desc}</p>
      <div className="mt-8 text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.02] text-white/40 text-sm">
        Coming next — wiring to Canton.
      </div>
    </div>
  )
}

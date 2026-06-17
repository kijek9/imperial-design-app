// Placeholder loga — podmień na plik graficzny w kolejnym etapie.
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-naglowek font-extrabold tracking-tight ${className}`}
    >
      <span className="text-akcent">Imperial</span>
      <span className="text-krem"> Design</span>
    </span>
  )
}

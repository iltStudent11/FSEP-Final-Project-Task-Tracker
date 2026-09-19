export default function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className="badge" data-tone={tone}>
      {label}
    </span>
  );
}

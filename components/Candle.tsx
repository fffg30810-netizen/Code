export default function Candle({ small = false }: { small?: boolean }) {
  return (
    <div
      aria-hidden
      className="flex flex-col items-center"
      style={small ? { transform: "scale(0.8)" } : undefined}
    >
      <div className="candle-flame" />
      <div className="candle-wick" />
      <div className="candle-wax" />
    </div>
  );
}

export function BeamsBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-black" />

      {/* Beam 1 */}
      <div
        className="absolute top-0 left-1/4 w-[600px] h-[1200px] opacity-[0.04]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
          transform: "rotate(-30deg) translateY(-200px)",
          animation: "beam-drift-1 12s ease-in-out infinite alternate",
        }}
      />

      {/* Beam 2 */}
      <div
        className="absolute top-0 right-1/4 w-[400px] h-[1400px] opacity-[0.03]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)",
          transform: "rotate(20deg) translateY(-300px)",
          animation: "beam-drift-2 16s ease-in-out infinite alternate",
        }}
      />

      {/* Beam 3 - subtle */}
      <div
        className="absolute top-0 left-1/2 w-[300px] h-[1000px] opacity-[0.025]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          transform: "rotate(-10deg) translateY(-100px)",
          animation: "beam-drift-3 20s ease-in-out infinite alternate",
        }}
      />

      {/* Radial glow at center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.04]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
        }}
      />

      <style>{`
        @keyframes beam-drift-1 {
          0% { transform: rotate(-30deg) translateY(-200px) translateX(0); }
          100% { transform: rotate(-30deg) translateY(-200px) translateX(60px); }
        }
        @keyframes beam-drift-2 {
          0% { transform: rotate(20deg) translateY(-300px) translateX(0); }
          100% { transform: rotate(20deg) translateY(-300px) translateX(-40px); }
        }
        @keyframes beam-drift-3 {
          0% { transform: rotate(-10deg) translateY(-100px) translateX(0); }
          100% { transform: rotate(-10deg) translateY(-100px) translateX(30px); }
        }
      `}</style>
    </div>
  );
}

import Beams from "./Beams";

export function BeamsBackground() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <Beams
        beamWidth={3.4}
        beamHeight={30}
        beamNumber={20}
        lightColor="#ffffff"
        speed={2}
        noiseIntensity={0.6}
        scale={0.2}
        rotation={30}
      />
    </div>
  );
}

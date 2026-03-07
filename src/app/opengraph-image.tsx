import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Emergency Vehicles Digital Twin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#111827",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 16,
          }}
        >
          Emergency Vehicles
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#9ca3af",
          }}
        >
          Digital Twin Platform
        </div>
      </div>
    ),
    { ...size }
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Command Center",
};

export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

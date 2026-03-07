"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { UserRole } from "@/types";

const NAV_ITEMS = [
  { href: "/command-center", label: "Command Center", icon: "🖥️" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/fleet", label: "Fleet", icon: "🚗" },
  { href: "/map", label: "Map", icon: "🗺️" },
  { href: "/alerts", label: "Alerts", icon: "🔔" },
  { href: "/simulation", label: "Simulation", icon: "🧪" },
  { href: "/insights", label: "Insights", icon: "💡" },
  { href: "/admin/users", label: "Admin", icon: "⚙️", requiredRole: "admin" as UserRole },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [insightsUnread, setInsightsUnread] = useState(0);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setUserRole(data.profile?.role ?? null);
      } catch {
        // silently ignore
      }
    };

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/insights/recommendations?limit=1");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setInsightsUnread(data.unreadCount ?? 0);
      } catch {
        // silently ignore polling errors
      }
    };

    fetchProfile();
    fetchUnread();
    const interval = setInterval(fetchUnread, 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.substring(0, 2).toUpperCase() ?? "??";

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700 flex items-center gap-3">
        <img
          src="/icon-192.png"
          alt=""
          width={36}
          height={36}
          className="rounded-lg flex-shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">Emergency Twin</h1>
          <p className="text-xs text-gray-400">Digital Twin POC</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        {NAV_ITEMS.map((item) => {
          if (item.requiredRole && userRole !== item.requiredRole) return null;

          const isActive = pathname.startsWith(item.href);
          const showBadge = item.href === "/insights" && insightsUnread > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                  {insightsUnread > 99 ? "99+" : insightsUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">
              {profile?.full_name || user?.email || "User"}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {profile?.role || "viewer"}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors mt-1"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
              clipRule="evenodd"
            />
            <path
              fillRule="evenodd"
              d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z"
              clipRule="evenodd"
            />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  Brain,
  CalendarDays,
  LogOut,
  Flame,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { createBrowserSupabase } from "@/lib/supabase/browser";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Study Sets", href: "/studio", icon: BookOpen },
  { label: "Flashcards", href: "#", icon: Brain },
  { label: "Schedule", href: "#", icon: CalendarDays },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [streak, setStreak] = useState(0);

  useEffect(() => {
    async function loadStreak() {
      const supabase = createBrowserSupabase();
      await supabase.rpc('record_daily_activity'); // Trigger daily check
      const { data } = await supabase
        .from('user_streaks')
        .select('current_streak')
        .single();
      if (data) {
        setStreak(data.current_streak);
      }
    }
    void loadStreak();
  }, []);

  const handleSignOut = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const closeNav = () => setMobileNavOpen(false);

  return (
    <div className="app-shell">
      <header className="app-shell-mobile-header">
        <div className="app-shell-mobile-brand">
          <div className="app-shell-logo">
            <Brain size={18} color="#fff" />
          </div>
          <h1>Episteme.</h1>
        </div>
        <button
          type="button"
          className="app-shell-menu-btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="app-shell-backdrop"
          onClick={closeNav}
        />
      )}

      <aside className={mobileNavOpen ? "app-shell-sidebar open" : "app-shell-sidebar"}>
        <div className="app-shell-brand-row">
          <div className="app-shell-mobile-brand">
            <div className="app-shell-logo">
              <Brain size={18} color="#fff" />
            </div>
            <h1>Episteme.</h1>
          </div>
          <button
            type="button"
            className="app-shell-menu-btn app-shell-mobile-close"
            onClick={closeNav}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="app-shell-nav">
          {navItems.map((item) => {
            const isActive = pathna{streak > 0 ? "var(--danger)" : "var(--muted)"} />
            <div>
              <div className="app-shell-streak-label">Current Streak</div>
              <div className="app-shell-streak-value">{streak} {streak === 1 ? "Day" : "Days"}
                href={item.href}
                onClick={closeNav}
                className={isActive ? "app-shell-nav-link active" : "app-shell-nav-link"}
              >
                <item.icon size={18} color={isActive ? "var(--accent-light)" : "currentColor"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-shell-footer">
          <div className="app-shell-streak">
            <Flame size={20} color="var(--danger)" />
            <div>
              <div className="app-shell-streak-label">Current Streak</div>
              <div className="app-shell-streak-value">12 Days</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              closeNav();
              void handleSignOut();
            }}
            className="app-shell-signout"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="app-shell-main">{children}</main>
    </div>
  );
}

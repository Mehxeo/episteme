"use client";

import Link from "next/link";
import { Brain, Sparkles, Clock, ArrowRight, Play, BookOpen, Plus, Activity } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

// Fallback/Extracted types for robust querying 
type Canvas = Database['public']['Tables']['canvases']['Row'];

export default function DashboardPage() {
  const [userName, setUserName] = useState("Student");
  const [recentCanvases, setRecentCanvases] = useState<Canvas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createBrowserSupabase();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserName(user.email.split('@')[0]);
      } else if (user?.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name);
      }

      const { data: canvases } = await supabase
        .from('canvases')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(3);

      if (canvases) setRecentCanvases(canvases);
      setLoading(false);
    }

    void loadDashboard();
  }, []);

  const quickActions = [
    { label: "New Study Set", icon: Plus, color: "var(--accent-light)", bg: "rgba(139, 92, 246, 0.1)", href: "/studio" },
    { label: "Import PDF", icon: BookOpen, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
    { label: "Generate Quiz", icon: Sparkles, color: "var(--ok)", bg: "rgba(16, 185, 129, 0.1)" },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            Welcome back, {userName}.
          </h1>
          <p className="dashboard-subtitle">
            Ready to master your knowledge?
          </p>
        </div>
        
        <Link href="/studio" className="btn primary btn-glow dashboard-start-btn">
          <Play size={18} fill="currentColor" />
          Start Review Session
        </Link>
      </header>

      <section className="dashboard-actions-grid">
        {quickActions.map((action, i) => (
          <Link
            href={action.href || "#"}
            key={i}
            className="glass-panel dashboard-action-card"
            style={{ "--action-color": action.color } as CSSProperties}
          >
            <div
              className="dashboard-action-icon"
              style={{ background: action.bg }}
            >
              <action.icon size={24} color={action.color} />
            </div>
            <div>
              <div className="dashboard-action-label">{action.label}</div>
            </div>
            <ArrowRight size={18} color="var(--muted)" className="dashboard-action-arrow" />
          </Link>
        ))}
      </section>

      <div className="dashboard-main-grid">
        <section className="glass-panel dashboard-card dashboard-recent">
          <div className="dashboard-card-head">
            <h2>Recent Canvas Sets</h2>
            <Link href="/studio" className="dashboard-link">
              View All
            </Link>
          </div>
          
          <div className="dashboard-set-list">
            {loading ? (
              <div className="empty-state">Loading your study sets...</div>
            ) : recentCanvases.length === 0 ? (
              <div className="empty-state">You don't have any study sets yet. Create one!</div>
            ) : (
              recentCanvases.map((set) => (
                <Link key={set.id} href={`/studio/${set.id}`} className="dashboard-set-row">
                  <div className="dashboard-set-row-head">
                    <div className="dashboard-set-title">{set.title}</div>
                    <div className="dashboard-set-date">
                      <Clock size={14} />
                      {new Date(set.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="dashboard-set-row-body">
                    <div className="dashboard-set-meta">
                      <Activity size={14} /> Open Canvas
                    </div>
                    <div className="dashboard-progress-track">
                      <div
                        className="dashboard-progress-fill"
                        style={{
                          width: `0%`,
                          background: 'var(--muted)'
                        }}
                      />
                    </div>
                    <div className="dashboard-progress-label">New</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="glass-panel dashboard-card dashboard-upcoming">
          <h2>Upcoming Goals/Exams</h2>
          <div className="dashboard-exam-list">
             {/* Note: This section remains empty to show you where to integrate your future scheduler data. The empty state matches reality rather than mockup. */}
             <div className="empty-state" style={{ color: "var(--muted)", fontStyle: "italic", marginTop: "1rem" }}>
               No upcoming goals or exams currently tracked.
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}

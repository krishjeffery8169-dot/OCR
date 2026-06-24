import { Link, NavLink, Outlet } from "react-router-dom";
import { BrainCircuit, DatabaseZap, LogOut, Radar, TableProperties, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformStore } from "@/store/usePlatformStore";

const navItems = [
  { to: "/crawl", label: "爬取任务", icon: Workflow },
  { to: "/model-crop", label: "模型截题", icon: BrainCircuit },
  { to: "/results", label: "抓取结果", icon: TableProperties },
  { to: "/sources", label: "来源配置", icon: DatabaseZap },
];

export function AppShell() {
  const { userName, logout, bootstrap } = usePlatformStore();

  return (
    <div className="min-h-screen bg-[#080a0f] text-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-6 py-6">
        <header className="mb-6 flex items-center justify-between rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur-xl">
          <div className="space-y-1">
            <Link to="/crawl" className="inline-flex items-center gap-3">
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-2 text-cyan-200">
                <Radar className="h-5 w-5" />
              </div>
              <div>
                <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.35em] text-cyan-200/80">
                  Crawl Control Deck
                </p>
                <h1 className="font-['Chakra_Petch'] text-2xl font-semibold tracking-[0.06em]">
                  公开题目爬取平台
                </h1>
              </div>
            </Link>
            <p className="text-sm text-zinc-400">
              来源白名单、爬取任务创建、结果样本沉淀。
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
              <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">
                Operator
              </p>
              <p className="text-sm font-medium text-zinc-100">{userName ?? "未登录"}</p>
              <p className="text-xs text-zinc-400">
                已完成任务 {bootstrap?.overview.completedJobCount ?? 0} 个
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-white/10 bg-white/5 p-4">
            <nav className="space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white",
                      isActive && "bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-400/20",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-h-[720px] rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_35%),rgba(255,255,255,0.03)] p-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

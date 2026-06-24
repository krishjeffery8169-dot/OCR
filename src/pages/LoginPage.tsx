import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Radar, ShieldCheck, Waypoints } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDemoCredentials } from "@/utils/platformApi";
import { usePlatformStore } from "@/store/usePlatformStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, token } = usePlatformStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (token) {
      navigate("/crawl");
    }
  }, [navigate, token]);

  return (
    <div className="min-h-screen bg-[#06080d] px-6 py-6 text-zinc-50">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1440px] gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.25),transparent_28%),linear-gradient(135deg,rgba(7,10,16,0.95),rgba(11,18,31,0.82))] p-8 lg:p-12">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.35em] text-cyan-100">
                <Radar className="h-4 w-4" />
                Authorized Collection Only
              </div>
              <h1 className="mt-8 max-w-3xl font-['Chakra_Petch'] text-5xl font-semibold leading-tight tracking-[0.04em] text-zinc-50">
                为 VLM 训练准备
                <span className="block text-cyan-200">公开题目爬取控制台</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300">
                这里先聚焦公开来源的样本爬取，不再混入标注流程、草稿提交和模板步骤。
                你进入后会直接看到来源配置、爬取任务创建和抓取结果样本。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
                <h2 className="mt-4 text-sm font-semibold text-zinc-100">合规爬取边界</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  只面向公开来源、白名单域名和可追溯样本。
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <Waypoints className="h-5 w-5 text-amber-200" />
                <h2 className="mt-4 text-sm font-semibold text-zinc-100">任务创建驱动</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  按来源、关键词、目标数量和是否保留预览图创建任务。
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <LockKeyhole className="h-5 w-5 text-emerald-200" />
                <h2 className="mt-4 text-sm font-semibold text-zinc-100">结果样本沉淀</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  抓取后的样本直接沉淀到结果页，优先看题面和来源。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl">
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-8">
            <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.35em] text-zinc-500">
              Operator Access
            </p>
            <h2 className="mt-4 font-['Chakra_Petch'] text-3xl font-semibold text-zinc-50">
              进入爬取平台
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              首版使用预置账号。登录后可直接体验来源配置、爬取任务创建和抓取结果预览。
            </p>

            <form
              className="mt-8 space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  await login(username, password);
                  navigate("/crawl");
                } catch (_error) {
                  return;
                }
              }}
            >
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">账号</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="请输入账号"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/40"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/40"
                />
              </label>

              <button
                type="button"
                onClick={async () => {
                  const demo = await getDemoCredentials();
                  setUsername(demo.username);
                  setPassword(demo.password);
                }}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
              >
                载入体验账号
              </button>

              {error ? (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:shadow-[0_0_30px_rgba(34,211,238,0.25)] disabled:opacity-60"
              >
                {loading ? "登录中..." : "进入平台"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <p className="font-['Chakra_Petch'] text-xs uppercase tracking-[0.3em] text-zinc-500">
                Demo Access
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                预置体验账号：<span className="font-medium text-cyan-100">annotator / vlm-demo</span>，也可以点击上方“载入体验账号”。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

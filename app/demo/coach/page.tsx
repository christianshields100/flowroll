import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/AppShell";
import { DEMO_TRANSCRIPT, loadDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

// Coach, as a real conversation looks — a recorded exchange, no live model.
export default async function DemoCoach() {
  const demo = await loadDemo();
  if (!demo) notFound();

  return (
    <AppShell profile={demo.profile} active="chat" demo>
      <div className="max-w-[680px] mx-auto">
        <div className="rise text-center border-b border-ink pb-6">
          <h1 className="text-[30px] sm:text-[34px] leading-[1.1] font-medium tracking-tightish">
            Your AI coaching resource
          </h1>
        </div>

        <div className="rise rise-2 mt-8">
          <div className="border-y border-paper-line py-5 space-y-5">
            {DEMO_TRANSCRIPT.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[75%] border border-ink bg-paper px-3.5 py-2.5 text-sm text-ink whitespace-pre-wrap"
                      : "max-w-[85%] bg-paper-sunken border-l-2 border-accent px-4 py-3 text-sm text-ink"
                  }
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown
                      allowedElements={["p", "ul", "ol", "li", "strong", "em", "code"]}
                      unwrapDisallowed
                      components={{
                        p: (props) => <p className="my-1 leading-relaxed" {...props} />,
                        ul: (props) => <ul className="my-1.5 list-disc pl-4 space-y-1" {...props} />,
                        ol: (props) => <ol className="my-1.5 list-decimal pl-4 space-y-1" {...props} />,
                        li: (props) => <li className="leading-relaxed" {...props} />,
                        strong: (props) => <strong className="font-semibold text-ink" {...props} />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-ink flex gap-3 items-end">
            <input
              type="text"
              disabled
              placeholder="Sign in to ask Coach about your own log…"
              aria-label="Message the Coach (disabled in the demo)"
              className="flex-1 bg-transparent border-b border-ink px-0 py-2.5 text-[15px] text-ink placeholder:italic placeholder:text-ink-mute disabled:opacity-60"
            />
            <Link
              href="/login"
              className="pressable bg-accent text-paper px-6 py-2.5 text-[13px] font-semibold hover:bg-accent-deep"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-[11px] italic text-ink-mute">
            A recorded exchange with the sample athlete. The real Coach reads your log, pulls
            your stats, and can file sessions from a sentence.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

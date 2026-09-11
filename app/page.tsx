"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ArrowRight, FileText, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Finding = {
  title: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  part: string;
  evidence: string;
  next: string;
};

type PanicToolInput = { log: string };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute: (input: unknown) => unknown;
        },
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

const demoLog = `panicString: SMC PANIC - ASSERT: smc.c: sensor array 0x800
product: iPhone14,3
missing sensor(s): mic1 prs0
initiator: SMC PANIC`;

const rules = [
  {
    test: (log: string) => /iPhone14,3/i.test(log) && /sensor array\s*0x800/i.test(log),
    finding: {
      title: "Charging port flex",
      confidence: "HIGH" as const,
      part: "Dock flex / charging-port sensor circuit",
      evidence: "iPhone14,3 reports the structured SMC sensor array value 0x800.",
      next: "Inspect the dock-flex connector, test with a known-good flex, then inspect the board-side sensor data path.",
    },
  },
  {
    test: (log: string) => /\b(mic1|mic2|prs0)\b/i.test(log),
    finding: {
      title: "Charging port sensor line",
      confidence: "HIGH" as const,
      part: "Charging port flex",
      evidence: "The panic references mic1, mic2, or prs0 — sensors commonly carried by the charging-port assembly.",
      next: "Check for liquid, connector damage, bent pins, and abnormal diode readings before replacing parts.",
    },
  },
  {
    test: (log: string) => /\bmic3\b/i.test(log),
    finding: {
      title: "Power button flex",
      confidence: "HIGH" as const,
      part: "Power / flash flex assembly",
      evidence: "The missing mic3 sensor points toward the upper power-button flex path.",
      next: "Inspect the upper flex and connector, then isolate with a known-good assembly.",
    },
  },
  {
    test: (log: string) => /\b(prox|als)\b/i.test(log),
    finding: {
      title: "Proximity sensor flex",
      confidence: "HIGH" as const,
      part: "Front sensor / proximity assembly",
      evidence: "The log names the proximity or ambient-light sensor path.",
      next: "Inspect the front sensor flex for tears or corrosion and verify the connector seating.",
    },
  },
  {
    test: (log: string) => /\b(tg0v|gas gauge|battery data)\b/i.test(log),
    finding: {
      title: "Battery data circuit",
      confidence: "MEDIUM" as const,
      part: "Battery / gas-gauge communication",
      evidence: "The panic contains a battery telemetry or gas-gauge token.",
      next: "Verify battery data lines, connector condition, and behavior with a known-good battery.",
    },
  },
];

const fallback: Finding = {
  title: "Board-side SMC communication",
  confidence: "LOW",
  part: "Sensor bus / logic board",
  evidence: "The log appears hardware-related, but no safely mapped part token was found yet.",
  next: "Confirm the full panicString and device identifier, then inspect all recently disturbed flex connections.",
};

function analyze(log: string): Finding[] {
  const matched = rules.filter((rule) => rule.test(log)).map((rule) => rule.finding);
  const unique = matched.filter((item, index, all) => all.findIndex((x) => x.title === item.title) === index);
  const fillers: Finding[] = [
    {
      title: "Connector or sensor data line",
      confidence: "MEDIUM",
      part: "Related flex connector",
      evidence: "SMC panics often occur when the expected sensor response is absent or unstable.",
      next: "Reseat and microscopically inspect the related connector before board repair.",
    },
    fallback,
  ];
  return [...unique, ...fillers].slice(0, 3);
}

export default function Home() {
  const [log, setLog] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "analyze_panic_log",
          title: "Analyze panic log",
          description: "Analyze an iPhone panic-full log and show the three most likely hardware paths in the visible workspace.",
          inputSchema: {
            type: "object",
            properties: { log: { type: "string", minLength: 1, maxLength: 100000 } },
            required: ["log"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute(input: unknown) {
            const candidate = input as Partial<PanicToolInput>;
            if (typeof candidate?.log !== "string" || !candidate.log.trim() || candidate.log.length > 100_000) {
              throw new Error("A panic log between 1 and 100,000 characters is required.");
            }
            const nextFindings = analyze(candidate.log);
            setLog(candidate.log);
            setFindings(nextFindings);
            return { findings: nextFindings.map(({ title, confidence, part }) => ({ title, confidence, part })) };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const readFile = async (file?: File) => {
    if (!file) return;
    setLog((await file.text()).slice(0, 100_000));
  };

  const run = () => {
    if (log.trim()) setFindings(analyze(log));
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#080b12] text-[#f7f7f2]">
      <div className="noise" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="logo-mark"><Activity size={19} strokeWidth={2.6} /></span>
          <div>
            <p className="text-sm font-extrabold tracking-tight">IC PANIC LOG TOOL</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8e99ad]">by IMEI Clear</p>
          </div>
        </div>
        <Badge className="border-[#343c4d] bg-[#111722] text-[#b7ff62]">Bench beta</Badge>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:pt-20">
        <div className="max-w-xl">
          <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b7ff62]">
            <Sparkles size={15} /> Fast evidence, fewer guesses
          </div>
          <h1 className="text-balance text-5xl font-black leading-[0.94] tracking-[-0.055em] sm:text-7xl">
            Your panic log,
            <span className="block text-[#ff6c3a]">translated.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#a7b0c2] sm:text-lg">
            Drop an iPhone panic-full log and get the three most likely hardware paths, the evidence behind each call, and the next checks for your bench.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {["Runs locally", "Evidence shown", "Built for shops"].map((item, index) => (
              <div key={item} className="mini-stat">
                <span>0{index + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
          <p className="mt-7 flex items-center gap-2 text-xs text-[#707b90]">
            <ShieldCheck size={15} /> Diagnostic aid only. Confirm findings with normal bench testing.
          </p>
        </div>

        <div className="tool-shell">
          <div className="tool-topline">
            <div><span className="status-dot" /> NEW ANALYSIS</div>
            <span>{log.length.toLocaleString()} / 100,000</span>
          </div>
          <div
            className={`drop-zone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); void readFile(event.dataTransfer.files[0]); }}
          >
            <Textarea
              value={log}
              onChange={(event) => setLog(event.target.value.slice(0, 100_000))}
              placeholder="Paste the panicString or full .ips log here…"
              className="min-h-56 resize-y border-0 bg-transparent p-5 font-mono text-xs leading-6 text-[#dfe5ef] shadow-none placeholder:text-[#566074] focus-visible:ring-0"
              aria-label="Panic log"
            />
            {!log && (
              <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
                <span className="rounded-full border border-[#343c4d] bg-[#111722] px-3 py-1.5 text-[11px] text-[#8993a6]">Drop .ips or .txt anywhere here</span>
              </div>
            )}
          </div>
          <input ref={fileRef} hidden type="file" accept=".ips,.txt,.log,text/plain,application/json" onChange={(event) => void readFile(event.target.files?.[0])} />
          <div className="flex flex-col gap-3 p-4 sm:flex-row">
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="h-12 flex-1 border-[#343c4d] bg-[#111722] text-[#d9deea] hover:bg-[#18202e] hover:text-white">
              <Upload /> Choose log
            </Button>
            <Button onClick={run} disabled={!log.trim()} className="h-12 flex-[1.4] bg-[#b7ff62] font-extrabold text-[#0a0d13] hover:bg-[#c8ff87] disabled:opacity-30">
              Analyze panic log <ArrowRight />
            </Button>
          </div>
          <button onClick={() => setLog(demoLog)} className="mb-4 ml-4 inline-flex items-center gap-2 text-xs font-semibold text-[#ff8c65] hover:text-[#ffad91]">
            <FileText size={14} /> Load a safe sample
          </button>
        </div>
      </section>

      {findings.length > 0 && (
        <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8" aria-live="polite">
          <div className="mb-5 flex items-end justify-between border-b border-[#252c39] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b7ff62]">Analysis complete</p>
              <h2 className="mt-1 text-2xl font-black">Most likely paths</h2>
            </div>
            <span className="hidden text-xs text-[#707b90] sm:block">Ranked by matched evidence</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {findings.map((item, index) => (
              <article key={`${item.title}-${index}`} className="result-card">
                <div className="flex items-center justify-between">
                  <span className="result-number">0{index + 1}</span>
                  <Badge className={`confidence confidence-${item.confidence.toLowerCase()}`}>{item.confidence}</Badge>
                </div>
                <h3>{item.title}</h3>
                <p className="part">{item.part}</p>
                <div className="result-copy"><strong>Why</strong><p>{item.evidence}</p></div>
                <div className="result-copy"><strong>Next check</strong><p>{item.next}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

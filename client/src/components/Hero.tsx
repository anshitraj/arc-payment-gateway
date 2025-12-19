import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 sm:pt-28 lg:pt-32">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.3 }}
          className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/3 blur-3xl"
        />
      </div>
      <svg
        className="absolute top-20 right-10 w-96 h-96 text-primary/10"
        viewBox="0 0 200 200"
        fill="none"
      >
        <motion.path
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          d="M 20 100 Q 100 20 180 100 Q 100 180 20 100"
          stroke="currentColor"
          strokeWidth="0.5"
          fill="none"
        />
        <motion.circle
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          cx="100"
          cy="100"
          r="3"
          fill="currentColor"
        />
      </svg>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <div className="flex flex-col items-center lg:items-start gap-3 mb-5 mt-4 sm:mt-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary">
                <span>Built on</span>
                <img src="/arc.webp" alt="Arc" className="h-4 w-auto object-contain" />
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1] mb-4">
              <span className="block">Intent-based</span>
              <span className="block bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                stablecoin payments on Arc
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-6">
              Accept USDC and EURC payments with near-instant finality, built-in cross-chain settlement, and optional gas sponsorship — all powered natively by Arc.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto gap-2" data-testid="button-get-started">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-docs">
                  View Documentation
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 mt-8 justify-center lg:justify-start">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span>&lt;1s settlement</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" />
                <span>USDC gas payments</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="w-4 h-4 text-primary" />
                <span>Deterministic finality</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="relative bg-card border border-border rounded-2xl p-6 shadow-xl shadow-primary/5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-3 text-xs text-muted-foreground font-mono">payment.ts</span>
              </div>
              <pre className="text-sm font-mono overflow-x-auto">
                <code className="text-muted-foreground">
                  <span className="text-blue-400">import</span> {" { ArcPay } "}
                  <span className="text-blue-400">from</span>{" "}
                  <span className="text-green-400">'arcpaykit'</span>;{"\n\n"}
                  <span className="text-blue-400">const</span> arc ={" "}
                  <span className="text-blue-400">new</span>{" "}
                  <span className="text-yellow-400">ArcPay</span>(apiKey);{"\n\n"}
                  <span className="text-blue-400">const</span> payment ={" "}
                  <span className="text-blue-400">await</span> arc.payments.
                  <span className="text-yellow-400">create</span>({"{"}
                  {"\n"}{"  "}amount:{" "}
                  <span className="text-purple-400">100.00</span>,{"\n"}{"  "}
                  currency:{" "}
                  <span className="text-green-400">'USDC'</span>,{"\n"}{"  "}
                  description:{" "}
                  <span className="text-green-400">'Premium Plan'</span>
                  {"\n"}{"}"});{"\n\n"}
                  <span className="text-slate-500">{"// Final in <1 second"}</span>
                  {"\n"}console.<span className="text-yellow-400">log</span>(
                  payment.status);{" "}
                  <span className="text-slate-500">{"// 'final'"}</span>
                </code>
              </pre>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
            <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

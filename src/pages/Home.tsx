import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  BookOpen,
  Trophy,
  Star,
  Flame,
  Rocket,
  Crown,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Target,
} from "lucide-react";
import { getCollectionCategories } from "@/lib/constants";
import OnboardingPlanSection from "@/components/home/OnboardingPlanSection";
import ToolsSection from "@/components/home/ToolsSection";

/* ── Badge tiers based on % of total published modules completed ── */
const BADGE_TIERS = [
  { min: 0,   label: "Explorer",   icon: Rocket,  color: "text-muted-foreground", bg: "bg-muted" },
  { min: 10,  label: "Learner",    icon: BookOpen, color: "text-info",             bg: "bg-info/10" },
  { min: 25,  label: "Achiever",   icon: Star,     color: "text-warning",          bg: "bg-warning/10" },
  { min: 50,  label: "Pro",        icon: Flame,    color: "text-secondary",        bg: "bg-secondary/10" },
  { min: 75,  label: "Expert",     icon: Trophy,   color: "text-primary",          bg: "bg-primary/10" },
  { min: 100, label: "Champion",   icon: Crown,    color: "text-secondary",        bg: "bg-secondary/15" },
];

function getCurrentBadge(pct: number) {
  let badge = BADGE_TIERS[0];
  for (const tier of BADGE_TIERS) {
    if (pct >= tier.min) badge = tier;
  }
  return badge;
}

function getNextBadge(pct: number) {
  for (const tier of BADGE_TIERS) {
    if (pct < tier.min) return tier;
  }
  return null;
}

export default function Home() {
  const { profile, user } = useAuth();
  const { isImpersonating, impersonating } = useImpersonation();
  const navigate = useNavigate();
  const activeProfile = isImpersonating ? impersonating : profile;
  const activeUserId = isImpersonating ? impersonating?.user_id : user?.id;
  const firstName = activeProfile?.full_name?.split(" ")[0] || "utente";

  const departmentToCategoryKey: Record<string, string> = {
    Sales: "sales",
    "Customer Success": "customer_success",
    Operations: "operations",
    Product: "product",
    Management: "management",
  };
  const userTeamKey = activeProfile?.department
    ? departmentToCategoryKey[activeProfile.department]
    : null;

  /* ── Queries ── */
  const { data: curricula } = useQuery({
    queryKey: ["curricula"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("curricula")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: completions } = useQuery({
    queryKey: ["module_completions", activeUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_completions")
        .select("*")
        .eq("user_id", activeUserId!);
      if (error) throw error;
      return data;
    },
    enabled: !!activeUserId,
  });

  /* ── Computed ── */
  const publishedCollections =
    curricula?.filter((c) => c.status === "published") ?? [];

  const filteredCollections = publishedCollections.filter((c) => {
    const cats = getCollectionCategories(c.categories);
    if (cats.includes("common")) return true;
    if (!userTeamKey) return true;
    return cats.includes(userTeamKey);
  });

  const publishedModules =
    modules?.filter(
      (m) =>
        m.status === "published" &&
        filteredCollections.some((c) => c.id === m.curriculum_id)
    ) ?? [];

  const completionSet = new Set(completions?.map((c) => c.module_id) ?? []);
  const completedCount = publishedModules.filter((m) =>
    completionSet.has(m.id)
  ).length;
  const totalModules = publishedModules.length;
  const globalPct =
    totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

  const currentBadge = getCurrentBadge(globalPct);
  const nextBadge = getNextBadge(globalPct);
  const BadgeIcon = currentBadge.icon;

  /* ── Per-collection stats for encouragement ── */
  const collectionStats = filteredCollections
    .map((c) => {
      const cModules = publishedModules.filter(
        (m) => m.curriculum_id === c.id
      );
      const cCompleted = cModules.filter((m) => completionSet.has(m.id)).length;
      return {
        ...c,
        moduleCount: cModules.length,
        completedCount: cCompleted,
        pct:
          cModules.length > 0
            ? Math.round((cCompleted / cModules.length) * 100)
            : 0,
      };
    })
    .filter((c) => c.moduleCount > 0);

  /* ── Encouragement messages ── */
  const encouragements: {
    type: "start" | "continue" | "complete";
    icon: typeof Sparkles;
    title: string;
    subtitle: string;
    collectionId: string;
  }[] = [];

  // Recently completed collection
  const justCompleted = collectionStats.find((c) => c.pct === 100);
  if (justCompleted) {
    encouragements.push({
      type: "complete",
      icon: Trophy,
      title: `Hai completato "${justCompleted.title}"! 🎉`,
      subtitle:
        "Ottimo lavoro! Continua così per raggiungere il prossimo livello.",
      collectionId: justCompleted.id,
    });
  }

  // In-progress collection closest to completion
  const inProgress = collectionStats
    .filter((c) => c.pct > 0 && c.pct < 100)
    .sort((a, b) => b.pct - a.pct);
  if (inProgress.length > 0) {
    const top = inProgress[0];
    const remaining = top.moduleCount - top.completedCount;
    encouragements.push({
      type: "continue",
      icon: Flame,
      title: `Mancano solo ${remaining} modul${remaining === 1 ? "o" : "i"}!`,
      subtitle: `Sei al ${top.pct}% di "${top.title}". Continua, ci sei quasi!`,
      collectionId: top.id,
    });
  }

  // Not-started collection
  const notStarted = collectionStats.filter((c) => c.pct === 0);
  if (notStarted.length > 0) {
    const next = notStarted[0];
    encouragements.push({
      type: "start",
      icon: Sparkles,
      title: `Inizia "${next.title}"`,
      subtitle: `${next.moduleCount} modul${next.moduleCount === 1 ? "o" : "i"} ti aspettan${next.moduleCount === 1 ? "o" : "o"} per far crescere le tue competenze.`,
      collectionId: next.id,
    });
  }

  const encouragementColors = {
    start: "border-l-info",
    continue: "border-l-warning",
    complete: "border-l-secondary",
  };

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
  };

  const pulse = {
    animate: {
      scale: [1, 1.06, 1],
      transition: { duration: 2.2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] as const },
    },
  };

  return (
    <motion.div
      className="space-y-8 max-w-3xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Welcome + Badge ── */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Bentornato, {firstName}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Ecco come sta andando il tuo percorso di formazione.
          </p>
        </div>

        {/* Badge */}
        <motion.div
          className={`flex items-center gap-3 px-5 py-3 rounded-xl ${currentBadge.bg} border border-border`}
          variants={pulse}
          animate="animate"
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${currentBadge.bg} ${currentBadge.color}`}
          >
            <BadgeIcon className="h-6 w-6" />
          </div>
          <div>
            <p className={`text-lg font-bold ${currentBadge.color}`}>
              {currentBadge.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{totalModules} moduli completati
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Global progress ── */}
      <motion.div variants={fadeUp}>
        <Card className="bg-card border-border">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">
                Progresso globale
              </span>
              <span className="font-mono text-foreground font-semibold">
                {globalPct}%
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${globalPct}%` }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
              />
            </div>
            {nextBadge && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5" />
                <span>
                  Prossimo badge:{" "}
                  <span className="font-semibold text-foreground">
                    {nextBadge.label}
                  </span>{" "}
                  al {nextBadge.min}%
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Encouragement cards ── */}
      {encouragements.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Il tuo prossimo passo
          </h2>
          {encouragements.map((e, idx) => {
            const EIcon = e.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + idx * 0.12 }}
              >
                <Card
                  className={`border-l-4 ${encouragementColors[e.type]} bg-card hover:shadow-md transition-shadow cursor-pointer`}
                  onClick={() => navigate(`/learn/${e.collectionId}`)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <EIcon className="h-5 w-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{e.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ── Onboarding plan ── */}
      {activeUserId && <OnboardingPlanSection userId={activeUserId} />}

      {/* ── Tools ── */}
      <ToolsSection department={activeProfile?.department ?? null} />

      {/* ── Collection overview ── */}
      <motion.div variants={fadeUp} className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Le tue collection
        </h2>
        <div className="grid gap-3">
          {collectionStats.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.6 + idx * 0.08 }}
            >
              <Card
                className="bg-card border-border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/learn/${c.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      c.pct === 100
                        ? "bg-secondary/15 text-secondary"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {c.pct === 100 ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <BookOpen className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground truncate">
                        {c.title}
                      </p>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] font-mono"
                      >
                        {c.completedCount}/{c.moduleCount}
                      </Badge>
                    </div>
                    <Progress value={c.pct} className="h-1.5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── CTA if everything is done ── */}
      {completedCount === totalModules && totalModules > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="p-6 text-center space-y-3">
              <Crown className="h-10 w-10 text-secondary mx-auto" />
              <h2 className="text-xl font-bold text-foreground">
                Hai completato tutto! 🏆
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Complimenti! Hai completato tutti i moduli di formazione.
                Continua a consultarli per rinfrescare le tue conoscenze.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/learn")}
                className="mt-2"
              >
                Vai alla Formazione
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

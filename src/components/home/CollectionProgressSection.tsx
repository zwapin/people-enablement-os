import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { BookOpen, ArrowRight } from "lucide-react";

interface CollectionStat {
  id: string;
  title: string;
  moduleCount: number;
  completedCount: number;
  pct: number;
}

interface Props {
  collectionStats: CollectionStat[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
};

export default function CollectionProgressSection({ collectionStats }: Props) {
  const navigate = useNavigate();

  // Show collections that are in progress (started but not completed)
  const inProgress = collectionStats
    .filter((c) => c.pct > 0 && c.pct < 100)
    .sort((a, b) => b.pct - a.pct);

  if (inProgress.length === 0) return null;

  return (
    <motion.div variants={fadeUp} className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          Le tue collection in corso
        </h2>
      </div>

      <div className="space-y-2">
        {inProgress.map((c) => {
          const remaining = c.moduleCount - c.completedCount;
          return (
            <Card
              key={c.id}
              className="bg-card border-border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/learn/${c.id}`)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground text-sm truncate flex-1 mr-3">
                    {c.title}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {c.completedCount}/{c.moduleCount}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                <Progress value={c.pct} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {remaining === 1
                    ? "Manca 1 modulo per completare"
                    : `Mancano ${remaining} moduli per completare`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
}

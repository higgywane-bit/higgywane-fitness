import {
  Activity,
  BicepsFlexed,
  Dumbbell,
  Flame,
  Footprints,
  RefreshCw,
  Salad,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { SpecialtyId } from "@/content/types";

export const SPECIALTY_ICON: Record<SpecialtyId, LucideIcon> = {
  "bodybuilding-prep": Trophy,
  "womens-recomp": RefreshCw,
  glutes: Target,
  posing: Sparkles,
  "fat-loss": Flame,
  nutrition: Salad,
  strength: Dumbbell,
  "get-jacked": BicepsFlexed,
  mobility: Activity,
  beginners: Footprints,
};

import { ShieldCheck, Eye, Pencil } from "lucide-react";
import { getPermissionActionLabelFromText } from "@/features/user-management/roleLabels";
import type { WorkflowLevel } from "./types";

export const FLOW_ARROW_ID = "workflow-level-flow-arrow";
export const STAGE_WIDTH = 980;
export const CARD_WIDTH = 360;
export const CARD_HEIGHT_SINGLE = 178;
export const CARD_HEIGHT_DOUBLE = 256;
export const LEFT_X = 48;
export const RIGHT_X = STAGE_WIDTH - CARD_WIDTH - LEFT_X;
export const TOP_Y = 24;
export const ROW_GAP = 302;
export const ADD_LEVEL_FLOAT_OFFSET = 8;

export const getSlotPosition = (index: number) => {
  const row = Math.floor(index / 2);
  const posInRow = index % 2;
  const isLeft = row % 2 === 0 ? posInRow === 0 : posInRow === 1;
  return { x: isLeft ? LEFT_X : RIGHT_X, y: TOP_Y + row * ROW_GAP };
};

export const getCardHeight = (level: WorkflowLevel) => (level.approvals.length > 1 ? CARD_HEIGHT_DOUBLE : CARD_HEIGHT_SINGLE);

export function getOptionState({
  optionId,
  level,
  currentValue,
  currentIndex,
  isRMUsedGlobally,
}: {
  optionId: string;
  level: WorkflowLevel;
  currentValue: string;
  currentIndex: number;
  isRMUsedGlobally: boolean;
}) {
  if (optionId === "no_approver") {
    const usedByPeer = level.approvals.some((approval, idx) => idx !== currentIndex && approval.option === optionId);
    return { disabled: usedByPeer };
  }
  if (optionId === "reporting_manager") {
    return { disabled: isRMUsedGlobally && currentValue !== "reporting_manager" };
  }
  const usedByPeer = level.approvals.some((approval, idx) => idx !== currentIndex && approval.option === optionId);
  return { disabled: usedByPeer };
}

export function getPermissionBadgeTheme(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "checker") {
    return { Icon: ShieldCheck, className: "bg-violet-50 text-violet-700" };
  }
  if (normalized === "maker") {
    return { Icon: Pencil, className: "bg-amber-50 text-amber-700" };
  }
  return { Icon: Eye, className: "bg-slate-100 text-slate-600" };
}

export const getOrderedPermissionLabels = (activeRights: string[]) => {
  const labels = new Set(activeRights.map((right) => getPermissionActionLabelFromText(right)));
  return ["Checker", "Maker", "Viewer"].filter((label) => labels.has(label));
};

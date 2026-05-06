import { useEffect, useMemo, useRef } from "react";
import { AlertCircle, CheckCircle2, Plus, Settings2, Trash2 } from "lucide-react";
import { APPROVAL_OPTIONS } from "@/features/workflow-management/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkflowLevel } from "./types";

type WorkflowStepLevelsProps = {
  levels: WorkflowLevel[];
  visibleLevels: number;
  errorMsg: string;
  isRMUsedGlobally: boolean;
  onUpdateApprover: (levelId: number, index: number, value: string) => void;
  onAddApprover: (levelId: number) => void;
  onRemoveApprover: (levelId: number, index: number) => void;
  onToggleLogic: (levelId: number) => void;
  onAddLevel: () => void;
  onRemoveLevel: () => void;
  canAddLevel: boolean;
  canRemoveLevel: boolean;
};

const FLOW_ARROW_ID = "workflow-level-flow-arrow";
const STAGE_WIDTH = 980;
const CARD_WIDTH = 330;
const CARD_HEIGHT_SINGLE = 178;
const CARD_HEIGHT_DOUBLE = 256;
const LEFT_X = 48;
const RIGHT_X = STAGE_WIDTH - CARD_WIDTH - LEFT_X;
const TOP_Y = 24;
const ROW_GAP = 302;
const ADD_LEVEL_FLOAT_OFFSET = 8;

const getSlotPosition = (index: number) => {
  const row = Math.floor(index / 2);
  const posInRow = index % 2;
  // Snake layout:
  // Row 0: Left -> Right
  // Row 1: Right -> Left
  // Row 2: Left -> Right
  const isLeft = row % 2 === 0 ? posInRow === 0 : posInRow === 1;

  return {
    x: isLeft ? LEFT_X : RIGHT_X,
    y: TOP_Y + row * ROW_GAP,
  };
};

function AddLevelButton({ onClick, locked }: { onClick: () => void; locked: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border-2 border-dashed px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] shadow-sm transition-all ${
        locked
          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
          : "border-blue-300 bg-white text-blue-600 hover:scale-[1.02] hover:border-blue-500 hover:bg-blue-50"
      }`}
      aria-label="Add next workflow level"
    >
      <Plus className="h-4 w-4" />
      Add level
    </button>
  );
}

function getOptionState({
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
  if (optionId === "reporting_manager") {
    return {
      disabled: isRMUsedGlobally && currentValue !== "reporting_manager",
    };
  }

  const usedByPeer = level.approvals.some((approval, idx) => idx !== currentIndex && approval.option === optionId);
  return {
    disabled: usedByPeer,
  };
}

const getCardHeight = (level: WorkflowLevel) => (level.approvals.length > 1 ? CARD_HEIGHT_DOUBLE : CARD_HEIGHT_SINGLE);

export default function WorkflowStepLevels({
  levels,
  visibleLevels,
  errorMsg,
  isRMUsedGlobally,
  onUpdateApprover,
  onAddApprover,
  onRemoveApprover,
  onToggleLogic,
  onAddLevel,
  onRemoveLevel,
  canAddLevel,
  canRemoveLevel,
}: WorkflowStepLevelsProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const renderedLevels = levels.slice(0, visibleLevels);

  const flowCards = useMemo(() => {
    return renderedLevels.map((level, idx) => {
      const slot = getSlotPosition(idx);
      return {
        level,
        idx,
        x: slot.x,
        y: slot.y,
        height: getCardHeight(level),
      };
    });
  }, [renderedLevels]);

  const nextSlot = useMemo(() => getSlotPosition(visibleLevels), [visibleLevels]);

  const addAnchor = useMemo(() => {
    if (flowCards.length === 0) {
      return { x: LEFT_X + CARD_WIDTH / 2, y: TOP_Y + CARD_HEIGHT_SINGLE / 2 };
    }

    const last = flowCards[flowCards.length - 1];
    const lastCenterX = last.x + CARD_WIDTH / 2;
    const lastBottomY = last.y + last.height;
    const nextCenterX = nextSlot.x + CARD_WIDTH / 2;
    const sameRow = last.y === nextSlot.y;

    if (sameRow) {
      const y = last.y + last.height / 2;
      const fromX = last.x < nextSlot.x ? last.x + CARD_WIDTH : last.x;
      const toX = last.x < nextSlot.x ? nextSlot.x : nextSlot.x + CARD_WIDTH;
      return { x: (fromX + toX) / 2, y };
    }

    return {
      // For snake row transition, keep the add-level button on the vertical drop
      // under the current active card (as the "turn" point).
      x: lastCenterX,
      y: (lastBottomY + nextSlot.y) / 2 + ADD_LEVEL_FLOAT_OFFSET,
    };
  }, [flowCards, nextSlot]);

  const stageHeight = Math.max(
    360,
    Math.max(
      ...flowCards.map((card) => card.y + card.height),
      nextSlot.y + CARD_HEIGHT_SINGLE,
    ) + 120,
  );

  useEffect(() => {
    const scroller = scrollContainerRef.current;
    const activeCard = activeCardRef.current;
    if (!scroller || !activeCard) return;

    const cardTop = activeCard.offsetTop;
    const cardBottom = cardTop + activeCard.offsetHeight;
    const viewTop = scroller.scrollTop;
    const viewBottom = viewTop + scroller.clientHeight;
    const topPadding = 24;
    const bottomPadding = 40;

    if (cardTop < viewTop + topPadding) {
      scroller.scrollTo({
        top: Math.max(0, cardTop - topPadding),
        behavior: "smooth",
      });
      return;
    }

    if (cardBottom > viewBottom - bottomPadding) {
      scroller.scrollTo({
        top: cardBottom - scroller.clientHeight + bottomPadding,
        behavior: "smooth",
      });
    }
  }, [visibleLevels, stageHeight]);

  return (
    <div className="relative h-full min-h-0 w-full p-3">
      <div
        ref={scrollContainerRef}
        className="absolute inset-3 overflow-x-auto overflow-y-auto overscroll-contain rounded-xl pr-2 pb-6 custom-scrollbar"
      >
        <div className="relative z-10 mx-auto w-max">
          <div className="relative rounded-xl bg-transparent">
            <div className="relative mx-auto" style={{ width: `${STAGE_WIDTH}px`, height: `${stageHeight}px` }}>
            <svg className="absolute inset-0" width={STAGE_WIDTH} height={stageHeight} aria-hidden="true">
              <defs>
                <marker
                  id={FLOW_ARROW_ID}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0 0L10 5L0 10Z" fill="#9eb1c9" />
                </marker>
              </defs>

              <g stroke="#9eb1c9" strokeWidth="2" strokeDasharray="6 6" fill="none" strokeLinecap="round" strokeLinejoin="round">
                {flowCards.map((card, idx) => {
                  const next = flowCards[idx + 1];
                  if (!next) return null;

                  const sameRow = card.y === next.y;
                  if (sameRow) {
                    const y = card.y + card.height / 2;
                    const fromX = card.x < next.x ? card.x + CARD_WIDTH : card.x;
                    const toX = card.x < next.x ? next.x : next.x + CARD_WIDTH;

                    return (
                      <line
                        key={`${card.level.id}-${next.level.id}`}
                        x1={fromX}
                        y1={y}
                        x2={toX}
                        y2={y}
                        markerEnd={`url(#${FLOW_ARROW_ID})`}
                      />
                    );
                  }

                  const fromX = card.x + CARD_WIDTH / 2;
                  const toX = next.x + CARD_WIDTH / 2;
                  const fromY = card.y + card.height;
                  const toY = next.y;
                  const midY = (fromY + toY) / 2;

                  return (
                    <path
                      key={`${card.level.id}-${next.level.id}`}
                      d={`M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`}
                      markerEnd={`url(#${FLOW_ARROW_ID})`}
                    />
                  );
                })}

                {flowCards.length > 0 && canAddLevel ? (
                  (() => {
                    const last = flowCards[flowCards.length - 1];
                    const sameRow = last.y === nextSlot.y;

                    if (sameRow) {
                      const y = last.y + last.height / 2;
                      const fromX = last.x < nextSlot.x ? last.x + CARD_WIDTH : last.x;
                      const toX = last.x < nextSlot.x ? nextSlot.x : nextSlot.x + CARD_WIDTH;
                      return <line x1={fromX} y1={y} x2={toX} y2={y} />;
                    }

                    const fromX = last.x + CARD_WIDTH / 2;
                    const fromY = last.y + last.height;
                    const toY = nextSlot.y;
                    return <line x1={fromX} y1={fromY} x2={fromX} y2={toY} />;
                  })()
                ) : null}
              </g>
            </svg>

            {flowCards.map(({ level, idx, x, y }) => (
              <div
                key={level.id}
                ref={idx + 1 === visibleLevels ? activeCardRef : null}
                className={`absolute w-[330px] rounded-[1rem] bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all ${
                  idx + 1 === visibleLevels ? "border-2 border-blue-400 ring-4 ring-blue-50" : "border border-slate-200"
                }`}
                style={{ left: `${x}px`, top: `${y}px` }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-black transition-colors ${
                        idx + 1 === visibleLevels ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      L{level.id}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Approvers</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {canRemoveLevel && idx + 1 === visibleLevels ? (
                      <button
                        type="button"
                        onClick={onRemoveLevel}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title={`Delete level ${level.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="group relative">
                    <Select value={level.approvals[0]?.option || ""} onValueChange={(value) => onUpdateApprover(level.id, 0, value)}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-700 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100">
                        <SelectValue placeholder="Select Approver" />
                      </SelectTrigger>
                      <SelectContent>
                        {APPROVAL_OPTIONS.map((option) => {
                          const state = getOptionState({
                            optionId: option.id,
                            level,
                            currentValue: level.approvals[0]?.option || "",
                            currentIndex: 0,
                            isRMUsedGlobally,
                          });
                          return (
                            <SelectItem key={option.id} value={option.id} disabled={state.disabled}>
                              {option.label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => onAddApprover(level.id)}
                    disabled={level.approvals.length >= 2}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      level.approvals.length >= 2
                        ? "cursor-not-allowed text-slate-300"
                        : "text-blue-600 hover:bg-blue-50"
                    }`}
                    title={level.approvals.length >= 2 ? "Maximum 2 approvers per level" : "Add additional approver"}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Approver
                  </button>

                  <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => level.type !== "AND" && onToggleLogic(level.id)}
                      disabled={level.approvals.length < 2}
                      className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                        level.type === "AND" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"
                      } ${level.approvals.length < 2 ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => level.type !== "OR" && onToggleLogic(level.id)}
                      disabled={level.approvals.length < 2}
                      className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                        level.type === "OR" ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-700"
                      } ${level.approvals.length < 2 ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      OR
                    </button>
                  </div>
                </div>

                {level.approvals.length > 1 ? (
                  <div className="mt-1.5 space-y-1.5">
                    <div className="flex items-center gap-2 py-0.5">
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-tight text-blue-500">
                        {level.type}
                      </span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="group relative">
                      <Select value={level.approvals[1]?.option || ""} onValueChange={(value) => onUpdateApprover(level.id, 1, value)}>
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-700 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100">
                          <SelectValue placeholder="Select Approver" />
                        </SelectTrigger>
                        <SelectContent>
                          {APPROVAL_OPTIONS.map((option) => {
                            const state = getOptionState({
                              optionId: option.id,
                              level,
                              currentValue: level.approvals[1]?.option || "",
                              currentIndex: 1,
                              isRMUsedGlobally,
                            });
                            return (
                              <SelectItem key={option.id} value={option.id} disabled={state.disabled}>
                                {option.label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => onRemoveApprover(level.id, 1)}
                        className="absolute -right-7 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                        title="Remove approver"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {canAddLevel ? (
              <div
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${addAnchor.x}px`, top: `${addAnchor.y}px` }}
              >
                <AddLevelButton onClick={onAddLevel} locked={!canAddLevel} />
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="fixed bottom-32 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border-2 border-red-100 bg-white px-6 py-3.5 shadow-xl animate-in fade-in slide-in-from-bottom-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-sm font-bold text-red-500">{errorMsg}</span>
        </div>
      ) : null}

      
    </div>
  );
}

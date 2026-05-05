import { useMemo } from "react";
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
const CARD_HEIGHT = 132;
const LEFT_X = 48;
const RIGHT_X = STAGE_WIDTH - CARD_WIDTH - LEFT_X;
const TOP_Y = 24;
const ROW_GAP = 172;

const getSlotPosition = (index: number) => {
  const row = Math.floor(index / 2);
  const inEvenRow = row % 2 === 0;
  const posInRow = index % 2;
  const isLeft = inEvenRow ? posInRow === 0 : posInRow === 1;

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
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm transition-all ${
        locked
          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
          : "border-blue-500 bg-white text-blue-500 hover:scale-105 hover:bg-blue-600 hover:text-white"
      }`}
      aria-label="Add next workflow level"
    >
      <Plus className="h-5 w-5" />
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
  const renderedLevels = levels.slice(0, visibleLevels);

  const flowCards = useMemo(() => {
    return renderedLevels.map((level, idx) => {
      const slot = getSlotPosition(idx);
      return {
        level,
        idx,
        x: slot.x,
        y: slot.y,
      };
    });
  }, [renderedLevels]);

  const nextSlot = useMemo(() => getSlotPosition(visibleLevels), [visibleLevels]);

  const addAnchor = useMemo(() => {
    if (flowCards.length === 0) {
      return { x: LEFT_X + CARD_WIDTH / 2, y: TOP_Y + CARD_HEIGHT / 2 };
    }

    const last = flowCards[flowCards.length - 1];
    const sameRow = last.y === nextSlot.y;

    if (sameRow) {
      const y = last.y + CARD_HEIGHT / 2;
      const fromX = last.x < nextSlot.x ? last.x + CARD_WIDTH : last.x;
      const toX = last.x < nextSlot.x ? nextSlot.x : nextSlot.x + CARD_WIDTH;
      return { x: (fromX + toX) / 2, y };
    }

    return {
      x: last.x + CARD_WIDTH / 2,
      y: (last.y + CARD_HEIGHT + nextSlot.y) / 2,
    };
  }, [flowCards, nextSlot]);

  const stageHeight = Math.max(320, Math.max(...flowCards.map((card) => card.y + CARD_HEIGHT), nextSlot.y + CARD_HEIGHT) + 36);

  return (
    <div className="relative h-full w-full p-3">
      <div className="relative z-10 mx-auto h-full w-full max-w-[1080px]">
        <div className="relative h-full rounded-xl bg-transparent">
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
                    const y = card.y + CARD_HEIGHT / 2;
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
                  const fromY = card.y + CARD_HEIGHT;
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
                      const y = last.y + CARD_HEIGHT / 2;
                      const fromX = last.x < nextSlot.x ? last.x + CARD_WIDTH : last.x;
                      const toX = last.x < nextSlot.x ? nextSlot.x : nextSlot.x + CARD_WIDTH;
                      return <line x1={fromX} y1={y} x2={toX} y2={y} />;
                    }

                    const fromX = last.x + CARD_WIDTH / 2;
                    const fromY = last.y + CARD_HEIGHT;
                    const toY = nextSlot.y;
                    return <line x1={fromX} y1={fromY} x2={fromX} y2={toY} />;
                  })()
                ) : null}
              </g>
            </svg>

            {flowCards.map(({ level, idx, x, y }) => (
              <div
                key={level.id}
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
                    {level.approvals.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => onToggleLogic(level.id)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-blue-600 hover:bg-blue-50"
                        title="Toggle AND/OR"
                      >
                        {level.type}
                      </button>
                    ) : null}
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
                  {level.approvals.map((approval, approverIdx) => (
                    <div key={`${level.id}-${approverIdx}`}>
                      {approverIdx === 1 ? (
                        <div className="flex items-center gap-2 py-0.5">
                          <div className="h-px flex-1 bg-slate-100" />
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[8px] font-black uppercase tracking-tight text-blue-500">
                            {level.type}
                          </span>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                      ) : null}

                      <div className="group relative">
                        <Select value={approval.option} onValueChange={(value) => onUpdateApprover(level.id, approverIdx, value)}>
                          <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-700 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100">
                            <SelectValue placeholder="Select Approver" />
                          </SelectTrigger>
                          <SelectContent>
                            {APPROVAL_OPTIONS.map((option) => {
                              const state = getOptionState({
                                optionId: option.id,
                                level,
                                currentValue: approval.option,
                                currentIndex: approverIdx,
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

                        {approverIdx > 0 ? (
                          <button
                            type="button"
                            onClick={() => onRemoveApprover(level.id, approverIdx)}
                            className="absolute -right-7 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                            title="Remove approver"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {canAddLevel ? (
              <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${addAnchor.x}px`, top: `${addAnchor.y}px` }}>
                <AddLevelButton onClick={onAddLevel} locked={!canAddLevel} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="fixed bottom-32 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border-2 border-red-100 bg-white px-6 py-3.5 shadow-xl animate-in fade-in slide-in-from-bottom-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-sm font-bold text-red-500">{errorMsg}</span>
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-6 right-6 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
        <Settings2 className="h-3.5 w-3.5" />
        Level Builder
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      </div>
    </div>
  );
}

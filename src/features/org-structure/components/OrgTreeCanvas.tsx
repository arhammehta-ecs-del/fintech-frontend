import { useEffect, type RefObject } from "react";
import type { OrgNode } from "@/contexts/AppContext";
import { OrgCard } from "@/features/org-structure/components/OrgCard";
import {
  buildTreeLayout,
  CANVAS_PADDING_X,
  CANVAS_PADDING_Y,
  collectAbsoluteNodes,
  LEVEL_STEP,
  VERTICAL_GAP,
  VIEWPORT_EDGE_PADDING,
} from "@/features/org-structure/treeLayout.utils";

type OrgTreeCanvasProps = {
  root: OrgNode;
  selectedId?: string;
  onSelect: (node: OrgNode) => void;
  onCreateNode: (node: OrgNode) => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onCanvasWidthChange?: (width: number) => void;
  zoom?: number;
};

export function OrgTreeCanvas({
  root,
  selectedId,
  onSelect,
  onCreateNode,
  scrollContainerRef,
  onCanvasWidthChange,
  zoom = 1,
}: OrgTreeCanvasProps) {
  const layout = buildTreeLayout(root);
  const topLevelBranchIndexMap = new Map(root.children.map((child, index) => [child.id, index] as const));
  const positionedNodes = collectAbsoluteNodes(layout, topLevelBranchIndexMap);
  const maxRight = positionedNodes.reduce((maximum, node) => Math.max(maximum, node.x + node.width), 0);
  const maxBottom = positionedNodes.reduce((maximum, node) => Math.max(maximum, node.y + node.height), 0);
  const minDiagramWidth = 920;
  const contentWidth = maxRight;
  const diagramWidth = Math.max(contentWidth + CANVAS_PADDING_X * 2, minDiagramWidth);
  const canvasWidth = diagramWidth;
  const canvasHeight = maxBottom + CANVAS_PADDING_Y * 2 + 24;
  const offsetX = (diagramWidth - (contentWidth + CANVAS_PADDING_X * 2)) / 2;
  const renderedCanvasWidth = Math.max(canvasWidth, 980);
  const scaledCanvasWidth = renderedCanvasWidth * zoom;
  const scaledCanvasHeight = canvasHeight * zoom;
  const outerCanvasWidth = scaledCanvasWidth + VIEWPORT_EDGE_PADDING * 2;

  useEffect(() => {
    onCanvasWidthChange?.(outerCanvasWidth);
  }, [onCanvasWidthChange, outerCanvasWidth]);

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full overflow-x-auto overflow-y-hidden bg-transparent [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        className="relative mx-auto"
        style={{
          width: `${outerCanvasWidth}px`,
          height: `${scaledCanvasHeight}px`,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top"
          style={{
            width: `${renderedCanvasWidth}px`,
            height: `${canvasHeight}px`,
            transformOrigin: "top left",
            left: `${VIEWPORT_EDGE_PADDING}px`,
            transform: `scale(${zoom})`,
          }}
        >
          <svg
            className="absolute inset-0"
            width={canvasWidth}
            height={canvasHeight}
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            aria-hidden="true"
          >
            {positionedNodes.flatMap((item) => {
              if (item.children.length === 0) return [];

              const parentCenterX = offsetX + CANVAS_PADDING_X + item.x + item.width / 2;
              const parentBottomY = CANVAS_PADDING_Y + item.y + item.height;
              const childTopY = CANVAS_PADDING_Y + item.children[0].y;
              const junctionY = parentBottomY + VERTICAL_GAP / 2;
              const childCenters = item.children.map((child) => offsetX + CANVAS_PADDING_X + child.x + child.width / 2);
              const leftMostChild = Math.min(...childCenters);
              const rightMostChild = Math.max(...childCenters);

              return [
                <line key={`${item.node.id}-stem`} x1={parentCenterX} y1={parentBottomY} x2={parentCenterX} y2={junctionY} stroke="#d8e0ec" strokeWidth="1.5" />,
                <line key={`${item.node.id}-branch`} x1={leftMostChild} y1={junctionY} x2={rightMostChild} y2={junctionY} stroke="#d8e0ec" strokeWidth="1.5" />,
                ...item.children.map((child) => {
                  const childCenterX = offsetX + CANVAS_PADDING_X + child.x + child.width / 2;
                  return (
                    <line
                      key={`${item.node.id}-${child.node.id}`}
                      x1={childCenterX}
                      y1={junctionY}
                      x2={childCenterX}
                      y2={childTopY}
                      stroke="#d8e0ec"
                      strokeWidth="1.5"
                    />
                  );
                }),
              ];
            })}
          </svg>

          {positionedNodes.map((item) => (
            <div
              key={item.node.id}
              className="absolute"
              style={{
                left: `${offsetX + CANVAS_PADDING_X + item.x}px`,
                top: `${CANVAS_PADDING_Y + item.y}px`,
              }}
            >
              <OrgCard
                node={item.node}
                branchIndex={item.branchIndex}
                branchDepth={item.branchDepth}
                compact={item.node.children.length === 0 && item.node.nodeType.trim().toUpperCase() !== "ROOT"}
                active={selectedId === item.node.id}
                onSelect={onSelect}
                onCreateNode={onCreateNode}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OrgTreeCanvas;

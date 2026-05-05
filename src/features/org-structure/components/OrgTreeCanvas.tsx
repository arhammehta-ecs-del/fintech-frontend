import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
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
  remeasureKey?: string;
  onSelect: (node: OrgNode) => void;
  onCreateNode: (node: OrgNode) => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  onCanvasWidthChange?: (width: number) => void;
  zoom?: number;
};

export function OrgTreeCanvas({
  root,
  selectedId,
  remeasureKey,
  onSelect,
  onCreateNode,
  scrollContainerRef,
  onCanvasWidthChange,
  zoom = 1,
}: OrgTreeCanvasProps) {
  const nodeElementRefs = useRef(new Map<string, HTMLDivElement>());
  const [measuredSizes, setMeasuredSizes] = useState<Map<string, { width: number; height: number }>>(new Map());

  const layout = buildTreeLayout(root, 0, measuredSizes);
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

  useLayoutEffect(() => {
    const nextSizes = new Map<string, { width: number; height: number }>();

    nodeElementRefs.current.forEach((element, nodeId) => {
      const cardBody = element.querySelector<HTMLElement>('[data-org-card-body="true"]');
      const rect = (cardBody ?? element).getBoundingClientRect();
      const safeZoom = zoom > 0 ? zoom : 1;
      nextSizes.set(nodeId, {
        // Rect is measured after CSS transform scale; convert back to logical canvas size.
        width: Math.ceil(rect.width / safeZoom),
        height: Math.ceil(rect.height / safeZoom),
      });
    });

    setMeasuredSizes((current) => {
      if (current.size === nextSizes.size) {
        let hasChange = false;
        nextSizes.forEach((size, key) => {
          const existing = current.get(key);
          if (!existing || existing.width !== size.width || existing.height !== size.height) {
            hasChange = true;
          }
        });
        if (!hasChange) {
          return current;
        }
      }

      return nextSizes;
    });
  }, [root, zoom, positionedNodes.length, selectedId, remeasureKey]);

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
            <g
              stroke="#d8e0ec"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
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
                <line key={`${item.node.id}-stem`} x1={parentCenterX} y1={parentBottomY} x2={parentCenterX} y2={junctionY + 1} />,
                <line key={`${item.node.id}-branch`} x1={leftMostChild - 1} y1={junctionY} x2={rightMostChild + 1} y2={junctionY} />,
                ...item.children.map((child) => {
                  const childCenterX = offsetX + CANVAS_PADDING_X + child.x + child.width / 2;
                  return (
                    <line
                      key={`${item.node.id}-${child.node.id}`}
                      x1={childCenterX}
                      y1={junctionY - 1}
                      x2={childCenterX}
                      y2={childTopY}
                    />
                  );
                }),
              ];
            })}
            </g>
          </svg>

          {positionedNodes.map((item) => (
            <div
              key={item.node.id}
              className="absolute"
              data-org-node-id={item.node.id}
              ref={(element) => {
                if (element) {
                  nodeElementRefs.current.set(item.node.id, element);
                } else {
                  nodeElementRefs.current.delete(item.node.id);
                }
              }}
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

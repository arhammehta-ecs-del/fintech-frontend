import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { NewNodeType } from "@/features/org-structure/types";
import { cn } from "@/lib/utils";

const NEW_NODE_NAME_MAX_LENGTH = 50;

type NewNodePopupProps = {
  open: boolean;
  parentNodeName: string;
  parentNodeTrail?: string[];
  nodeTypes: NewNodeType[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, nodeType: NewNodeType) => void;
};

function formatNodeTypeLabel(nodeType: string) {
  return nodeType
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toTitleCase(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^\s/, "")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function NewNodePopup({
  open,
  parentNodeName,
  parentNodeTrail = [],
  nodeTypes,
  onOpenChange,
  onConfirm,
}: NewNodePopupProps) {
  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState<NewNodeType>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const displayParentNodeName = parentNodeName.trim() || "New Node";
  const displayTrail = parentNodeTrail.length > 0 ? parentNodeTrail : [displayParentNodeName];
  const previewNodeName = name.trim() || "New Node";

  useEffect(() => {
    if (!open) return;
    setName("");
    setNodeType(nodeTypes[0] ?? "");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, nodeTypes]);

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(toTitleCase(name).trim(), nodeType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[45rem] overflow-visible gap-0 rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_20px_64px_rgba(15,23,42,0.16)]">
        <DialogHeader className="border-b border-slate-100 px-5 pb-2.5 pt-4">
          <DialogTitle className="text-[1.5rem] font-semibold tracking-[-0.02em] text-slate-950">
            Create Node
          </DialogTitle>
          <div className="mt-2 rounded-2xl border border-blue-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.88),rgba(248,250,252,0.96))] px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              Creating Under
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {displayTrail.map((nodeName, index) => (
                <div key={`${nodeName}-${index}`} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-sm font-semibold shadow-sm",
                      index === displayTrail.length - 1
                        ? "bg-[#3553E9] text-white"
                        : "bg-white text-slate-700 ring-1 ring-slate-200",
                    )}
                  >
                    {nodeName}
                  </span>
                  {index !== displayTrail.length - 1 ? (
                    <span className="shrink-0 text-slate-400" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                </div>
              ))}
              <span className="shrink-0 text-slate-400" aria-hidden="true">
                →
              </span>
              <span className="inline-flex rounded-full bg-blue-50/90 px-2.5 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08)]">
                {previewNodeName}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-5 py-3.5">
          <div className="space-y-2">
            <Label htmlFor="new-node-name" className="text-[15px] font-medium text-slate-900">
              Node name
            </Label>
            <Input
              id="new-node-name"
              ref={inputRef}
              value={name}
              onChange={(event) => setName(toTitleCase(event.target.value))}
              maxLength={NEW_NODE_NAME_MAX_LENGTH}
              className="h-10 rounded-xl border-slate-200 px-3.5 text-[15px] shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/70"
              placeholder="e.g., Operations"
            />
            <div className="flex items-center justify-end">
              <span
                className={cn(
                  "text-xs tabular-nums text-slate-500",
                  name.length >= NEW_NODE_NAME_MAX_LENGTH && "font-medium text-amber-600",
                )}
              >
                {name.length}/{NEW_NODE_NAME_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[15px] font-medium text-slate-900">
              Node Type
            </Label>
            <div>
              <Select
                value={nodeType}
                onValueChange={(val) => setNodeType(val as NewNodeType)}
              >
                <SelectTrigger id="node-type" className="h-10 rounded-xl border-slate-200 px-3.5 text-[15px] shadow-sm">
                  <SelectValue placeholder="Select node type">
                    {nodeType ? formatNodeTypeLabel(nodeType) : "Select node type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {nodeTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatNodeTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:space-x-2.5">
          <Button variant="outline" className="h-10 rounded-xl px-5" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-10 min-w-[160px] rounded-xl px-6" onClick={handleConfirm} disabled={!name.trim() || !nodeType}>
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewNodePopup;

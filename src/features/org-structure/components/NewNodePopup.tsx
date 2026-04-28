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

export function NewNodePopup({
  open,
  parentNodeName,
  nodeTypes,
  onOpenChange,
  onConfirm,
}: NewNodePopupProps) {
  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState<NewNodeType>("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const displayParentNodeName = parentNodeName.trim() || "New Node";

  useEffect(() => {
    if (!open) return;
    setName("");
    setNodeType(nodeTypes[0] ?? "");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, nodeTypes]);

  const handleConfirm = () => {
    if (!name.trim()) return;
    onConfirm(name.trim(), nodeType);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[56rem] overflow-visible gap-0 rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <DialogHeader className="border-b border-slate-100 px-7 pb-5 pt-7">
          <DialogTitle className="text-[2rem] font-semibold tracking-[-0.03em] text-slate-950">
            Create Node
          </DialogTitle>
          <div className="mt-4 rounded-2xl border border-blue-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.88),rgba(248,250,252,0.96))] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              Creating Under
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex max-w-full truncate rounded-full bg-[#3553E9] px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
                {displayParentNodeName}
              </span>
              <span className="shrink-0 text-slate-400" aria-hidden="true">
                →
              </span>
              <span className="inline-flex rounded-full bg-[#eef2ff] px-3 py-1.5 text-sm font-semibold text-[#3553E9] ring-1 ring-[#c7d2fe]">
                New Node
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-7 py-6">
          <div className="space-y-2.5">
            <Label htmlFor="new-node-name" className="text-[15px] font-medium text-slate-900">
              New Node Name
            </Label>
            <Input
              id="new-node-name"
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={NEW_NODE_NAME_MAX_LENGTH}
              className="h-12 rounded-xl border-slate-200 px-4 text-[15px] shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500/70"
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

          <div className="space-y-2.5">
            <Label htmlFor="node-type" className="text-[15px] font-medium text-slate-900">
              Node Type ({nodeTypes.length})
            </Label>
                 <Select value={nodeType} onValueChange={(val) => setNodeType(val as NewNodeType)}>
              <SelectTrigger id="node-type" className="h-12 rounded-xl border-slate-200 px-4 text-[15px] shadow-sm">
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

        <DialogFooter className="border-t border-slate-100 px-7 py-5 sm:flex-row sm:items-center sm:justify-end sm:space-x-3">
          <Button variant="outline" className="h-11 rounded-xl px-5" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-11 min-w-[168px] rounded-xl px-6" onClick={handleConfirm} disabled={!name.trim() || !nodeType}>
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NewNodePopup;

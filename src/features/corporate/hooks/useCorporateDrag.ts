import { useState, type DragEvent, type Dispatch, type SetStateAction } from "react";
import type { GroupCompany } from "@/contexts/AppContext";
import type { DragPayload } from "@/features/corporate/types";
import { reorderItems } from "@/features/corporate/utils";

type SetGroups = Dispatch<SetStateAction<GroupCompany[]>>;

export function useCorporateDrag(setGroups: SetGroups) {
  const [dragState, setDragState] = useState<DragPayload | null>(null);

  const handleDragStart = (payload: DragPayload) => (event: DragEvent<HTMLElement>) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    setDragState(payload);
  };

  const handleDragEnd = () => {
    setDragState(null);
  };

  const handleDragOver = (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => {
    if (!dragState) return;
    const isSameGroupMove =
      dragState.type === "group" && payload.type === "group" && dragState.groupId !== payload.groupId;
    const isSameSubsidiaryMove =
      dragState.type === "subsidiary" &&
      payload.type === "subsidiary" &&
      dragState.groupId === payload.groupId &&
      dragState.companyId !== payload.companyId;

    if (isSameGroupMove || isSameSubsidiaryMove) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  };

  const handleDrop = (payload: DragPayload) => (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    if (!dragState) return;

    if (dragState.type === "group" && payload.type === "group" && dragState.groupId !== payload.groupId) {
      setGroups((previousGroups) => {
        const fromIndex = previousGroups.findIndex((group) => group.id === dragState.groupId);
        const toIndex = previousGroups.findIndex((group) => group.id === payload.groupId);
        if (fromIndex === -1 || toIndex === -1) return previousGroups;
        return reorderItems(previousGroups, fromIndex, toIndex);
      });
    }

    if (
      dragState.type === "subsidiary" &&
      payload.type === "subsidiary" &&
      dragState.groupId === payload.groupId &&
      dragState.companyId !== payload.companyId
    ) {
      setGroups((previousGroups) =>
        previousGroups.map((group) => {
          if (group.id !== payload.groupId) return group;
          const fromIndex = group.subsidiaries.findIndex((company) => company.id === dragState.companyId);
          const toIndex = group.subsidiaries.findIndex((company) => company.id === payload.companyId);
          if (fromIndex === -1 || toIndex === -1) return group;
          return {
            ...group,
            subsidiaries: reorderItems(group.subsidiaries, fromIndex, toIndex),
          };
        }),
      );
    }

    setDragState(null);
  };

  return { dragState, handleDragStart, handleDragEnd, handleDragOver, handleDrop };
}

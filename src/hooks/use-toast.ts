import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

// Keep only one toast on screen at a time.
const TOAST_LIMIT = 1;
// Wait this long before fully removing a dismissed toast from memory.
const TOAST_REMOVE_DELAY = 1000000;

// This is the full toast shape used inside this hook/store.
type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

// Simple counter used to create unique toast ids.
let count = 0;

// Creates the next toast id as a string.
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

// All actions that can change toast state.
type Action =
  | {
      type: "ADD_TOAST";
      toast: ToasterToast;
    }
  | {
    //for future help from saveing... to saved!!
      type: "UPDATE_TOAST";
      toast: Partial<ToasterToast>;
    }
  | {
      type: "DISMISS_TOAST";
      toastId?: ToasterToast["id"];
    }
  | {
      type: "REMOVE_TOAST";
      toastId?: ToasterToast["id"];
    };

// The in-memory toast list.
interface State {
  toasts: ToasterToast[];
}

// Keeps track of delayed remove timers for each toast.
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// Adds one toast id to the delayed remove queue.
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

// Cancels a pending remove timer for one toast.
const clearToastTimeout = (toastId: string) => {
  const timeout = toastTimeouts.get(toastId);
  if (!timeout) {
    return;
  }

  clearTimeout(timeout);
  toastTimeouts.delete(toastId);
};

// Schedules one or more toasts for delayed removal.
const scheduleToastDismissal = (toastIds: string[]) => {
  toastIds.forEach(addToRemoveQueue);
};

// Marks one toast, or all toasts, as closed.
const dismissToasts = (state: State, toastId?: string) => {
  const toastIds = toastId ? [toastId] : state.toasts.map((toast) => toast.id);
  scheduleToastDismissal(toastIds);

  return {
    ...state,
    toasts: state.toasts.map((toast) =>
      toastId === undefined || toast.id === toastId
        ? {
            ...toast,
            open: false,
          }
        : toast,
    ),
  };
};

// Main reducer that updates the toast list.
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST":
      return dismissToasts(state, action.toastId);
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        toastTimeouts.forEach((timeout) => clearTimeout(timeout));
        toastTimeouts.clear();
        return {
          ...state,
          toasts: [],
        };
      }
      clearToastTimeout(action.toastId);
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

// List of hook subscribers that should get toast updates.
const listeners: Array<(state: State) => void> = [];

// Shared memory state so new subscribers can read the latest toast list.
let memoryState: State = { toasts: [] };

// Updates the store and notifies every subscriber.
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

// Public helper used by app code to show a toast.
function toast({ ...props }: Toast) {
  const id = genId();

  // Lets callers update or dismiss the same toast later.
  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  // Add the toast to the store immediately as open.
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id: id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  // Subscribe this component to future toast changes.
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

export { useToast };

export function getOrgNodeTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return {
      edge: "bg-sky-400",
      card: "border-slate-200",
      hover: "hover:border-sky-200 hover:bg-sky-50/40",
      selected: "border-sky-300 bg-sky-50/60 shadow-[0_0_0_4px_rgba(96,165,250,0.08)]",
    };
  }

  if (normalized === "LOCATION") {
    return {
      edge: "bg-emerald-400",
      card: "border-slate-200",
      hover: "hover:border-emerald-200 hover:bg-emerald-50/40",
      selected: "border-emerald-300 bg-emerald-50/60 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]",
    };
  }

  if (normalized === "DEPARTMENT") {
    return {
      edge: "bg-amber-400",
      card: "border-slate-200",
      hover: "hover:border-amber-200 hover:bg-amber-50/40",
      selected: "border-amber-200 bg-amber-50/60 shadow-[0_0_0_4px_rgba(251,191,36,0.08)]",
    };
  }

  if (normalized === "ROOT") {
    return {
      edge: "",
      card: "border border-slate-200",
      hover: "hover:border-slate-300 hover:bg-slate-50",
      selected: "border-slate-300 bg-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
    };
  }

  return {
    edge: "bg-slate-300",
    card: "border-slate-200",
    hover: "hover:border-slate-300 hover:bg-slate-50",
    selected: "border-slate-300 bg-slate-50 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
  };
}

export function getOrgNodeBadgeTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return "border border-sky-200 bg-sky-50 text-sky-600";
  }

  if (normalized === "LOCATION") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-600";
  }

  if (normalized === "DEPARTMENT") {
    return "border border-amber-200 bg-amber-50 text-amber-600";
  }

  return "border border-slate-200 bg-slate-50 text-slate-500";
}

export function getOrgNodePermissionChipTheme(nodeType: string) {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return "border border-sky-200 bg-sky-100 text-sky-700";
  }

  if (normalized === "LOCATION") {
    return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  }

  if (normalized === "DEPARTMENT") {
    return "border border-amber-200 bg-amber-100 text-amber-700";
  }

  return "border border-slate-200 bg-slate-100 text-slate-600";
}

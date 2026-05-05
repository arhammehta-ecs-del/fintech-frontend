import { Briefcase, Boxes, Building2, Layers3, MapPin } from "lucide-react";

const BRANCH_PALETTES = [
  {
    accentSteps: ["bg-orange-500", "bg-orange-300", "bg-orange-200", "bg-orange-100"],
    strongAccent: "bg-orange-500",
    softAccent: "bg-orange-300",
    hoverBorder: "hover:border-orange-200",
    activeBorder: "border-orange-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-sky-500", "bg-sky-300", "bg-sky-200", "bg-sky-100"],
    strongAccent: "bg-sky-500",
    softAccent: "bg-sky-300",
    hoverBorder: "hover:border-sky-200",
    activeBorder: "border-sky-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-emerald-500", "bg-emerald-300", "bg-emerald-200", "bg-emerald-100"],
    strongAccent: "bg-emerald-500",
    softAccent: "bg-emerald-300",
    hoverBorder: "hover:border-emerald-200",
    activeBorder: "border-emerald-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-rose-500", "bg-rose-300", "bg-rose-200", "bg-rose-100"],
    strongAccent: "bg-rose-500",
    softAccent: "bg-rose-300",
    hoverBorder: "hover:border-rose-200",
    activeBorder: "border-rose-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-amber-500", "bg-amber-300", "bg-amber-200", "bg-amber-100"],
    strongAccent: "bg-amber-500",
    softAccent: "bg-amber-300",
    hoverBorder: "hover:border-amber-200",
    activeBorder: "border-amber-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
  {
    accentSteps: ["bg-cyan-500", "bg-cyan-300", "bg-cyan-200", "bg-cyan-100"],
    strongAccent: "bg-cyan-500",
    softAccent: "bg-cyan-300",
    hoverBorder: "hover:border-cyan-200",
    activeBorder: "border-cyan-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
  },
] as const;

export const resolveNodeThemeClass = (isSelected: boolean) => (isSelected ? "border-primary shadow-sm" : "border-slate-200");

export const getNodeTheme = (nodeType: string) => {
  const normalized = nodeType.trim().toUpperCase();

  if (normalized === "DIVISION") {
    return {
      accent: "border-l-[5px] border-l-sky-400",
      ring: "border-sky-300 shadow-[0_0_0_4px_rgba(96,165,250,0.08)]",
      icon: Layers3,
      iconColor: "text-slate-500",
    };
  }

  if (normalized === "LOCATION") {
    return {
      accent: "border-l-[5px] border-l-emerald-400",
      ring: "border-emerald-300 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]",
      icon: MapPin,
      iconColor: "text-slate-500",
    };
  }

  if (normalized === "ROOT") {
    return {
      accent: "border border-slate-200",
      ring: "border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
      icon: Building2,
      iconColor: "text-slate-500",
    };
  }

  if (normalized === "DEPARTMENT") {
    return {
      accent: "border-l-[5px] border-l-amber-400",
      ring: "border-amber-200 shadow-[0_0_0_4px_rgba(251,191,36,0.08)]",
      icon: Briefcase,
      iconColor: "text-slate-500",
    };
  }

  return {
    accent: "border-l-[5px] border-l-slate-300",
    ring: "border-slate-200 shadow-[0_8px_24px_rgba(15,23,42,0.04)]",
    icon: Boxes,
    iconColor: "text-slate-500",
  };
};

export const getNodeIcon = (nodeType: string) => {
  const normalizedType = nodeType.trim().toUpperCase();
  if (normalizedType === "ROOT") return Building2;
  if (normalizedType === "DIVISION") return Layers3;
  if (normalizedType === "LOCATION") return MapPin;
  if (normalizedType === "DEPARTMENT") return Briefcase;
  return Boxes;
};

export const getNodeAccentBackground = (branchIndex: number | null, branchDepth: number, isRoot: boolean) => {
  if (isRoot || branchIndex === null) {
    return "bg-slate-400";
  }

  const palette = BRANCH_PALETTES[branchIndex % BRANCH_PALETTES.length];
  return palette.accentSteps[Math.min(branchDepth, palette.accentSteps.length - 1)];
};

export const getNodeAccentBorderLeft = (branchIndex: number | null, branchDepth: number, isRoot: boolean) => {
  if (isRoot || branchIndex === null) {
    return "border-l-slate-400";
  }

  const palettes = [
    ["border-l-orange-500", "border-l-orange-300", "border-l-orange-200", "border-l-orange-100"],
    ["border-l-sky-500", "border-l-sky-300", "border-l-sky-200", "border-l-sky-100"],
    ["border-l-emerald-500", "border-l-emerald-300", "border-l-emerald-200", "border-l-emerald-100"],
    ["border-l-rose-500", "border-l-rose-300", "border-l-rose-200", "border-l-rose-100"],
    ["border-l-amber-500", "border-l-amber-300", "border-l-amber-200", "border-l-amber-100"],
    ["border-l-cyan-500", "border-l-cyan-300", "border-l-cyan-200", "border-l-cyan-100"],
  ];
  
  const palette = palettes[branchIndex % palettes.length];
  return palette[Math.min(branchDepth, palette.length - 1)];
};

export const getBranchAppearance = (branchIndex: number | null, branchDepth: number, isRoot: boolean) => {
  if (isRoot || branchIndex === null) {
    return {
      accentClass: "bg-slate-200",
      hoverBorderClass: "hover:border-indigo-700",
      defaultSurfaceClass: "border-2 border-indigo-600 bg-indigo-600 shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
      activeBorderClass: "border-2 border-indigo-700 bg-indigo-700 shadow-[0_14px_30px_rgba(15,23,42,0.16)]",
    };
  }

  const palette = BRANCH_PALETTES[branchIndex % BRANCH_PALETTES.length];
  const isPrimaryBranchNode = branchDepth === 0;

  return {
    accentClass: isPrimaryBranchNode ? palette.strongAccent : palette.softAccent,
    hoverBorderClass: palette.hoverBorder,
    defaultSurfaceClass: "border border-slate-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]",
    activeBorderClass: palette.activeBorder,
  };
};

export const getPlusButtonAccentClass = (accentBackgroundClass: string) => {
  switch (accentBackgroundClass) {
    case "bg-orange-500":
    case "bg-orange-300":
    case "bg-orange-200":
    case "bg-orange-100":
      return "hover:border-orange-300 hover:text-orange-500";
    case "bg-sky-500":
    case "bg-sky-300":
    case "bg-sky-200":
    case "bg-sky-100":
      return "hover:border-sky-300 hover:text-sky-500";
    case "bg-emerald-500":
    case "bg-emerald-300":
    case "bg-emerald-200":
    case "bg-emerald-100":
      return "hover:border-emerald-300 hover:text-emerald-500";
    case "bg-rose-500":
    case "bg-rose-300":
    case "bg-rose-200":
    case "bg-rose-100":
      return "hover:border-rose-300 hover:text-rose-500";
    case "bg-amber-500":
    case "bg-amber-300":
    case "bg-amber-200":
    case "bg-amber-100":
      return "hover:border-amber-300 hover:text-amber-500";
    case "bg-cyan-500":
    case "bg-cyan-300":
    case "bg-cyan-200":
    case "bg-cyan-100":
      return "hover:border-cyan-300 hover:text-cyan-500";
    default:
      return "hover:border-slate-300 hover:text-slate-600";
  }
};

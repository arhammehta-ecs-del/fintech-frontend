import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Database, ShieldCheck, Workflow } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppContext } from "@/contexts/AppContext";
import { getCompanyRoles, type RoleRecord } from "@/services/role.service";

type RoleRow = {
  module: string;
  levels: Record<string, string>;
  isPrimary: boolean;
};

type RoleCategory = {
  key: string;
  title: string;
  icon: typeof CreditCard;
  theme: {
    headerBg: string;
    iconBg: string;
    iconColor: string;
    border: string;
  };
  rows: RoleRow[];
};

type RolesAllocationPanelProps = {
  userName?: string;
  showUserNote?: boolean;
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getCategoryMeta = (categoryKey: string) => {
  switch (categoryKey) {
    case "TRANSACTIONAL":
      return { title: "Transactional", icon: CreditCard, theme: { headerBg: "bg-white group-hover:bg-slate-50", iconBg: "bg-blue-100", iconColor: "text-blue-600", border: "border-l-[4px] border-l-blue-300" } };
    case "OPERATIONAL":
      return { title: "Operational Controls", icon: Database, theme: { headerBg: "bg-white group-hover:bg-slate-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", border: "border-l-[4px] border-l-amber-300" } };
    case "SYSTEM_ACCESS":
      return { title: "System Access", icon: Workflow, theme: { headerBg: "bg-white group-hover:bg-slate-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", border: "border-l-[4px] border-l-emerald-300" } };
    default:
      return { title: formatLabel(categoryKey), icon: ShieldCheck, theme: { headerBg: "bg-white group-hover:bg-slate-50", iconBg: "bg-slate-100", iconColor: "text-slate-600", border: "border-l-[4px] border-l-slate-300" } };
  }
};

const parseRoleCode = (roleCode: string, fallbackLevel: string) => {
  const normalized = roleCode.trim().toUpperCase();
  if (!normalized) {
    return { moduleKey: "UNKNOWN", levelKey: fallbackLevel.trim().toUpperCase() || "UNKNOWN" };
  }

  const parts = normalized.split("_").filter(Boolean);
  if (parts.length < 2) {
    return { moduleKey: normalized, levelKey: fallbackLevel.trim().toUpperCase() || "UNKNOWN" };
  }

  const levelKey = parts.at(-1) || fallbackLevel.trim().toUpperCase() || "UNKNOWN";
  const moduleKey = parts.slice(0, -1).join("_") || "UNKNOWN";

  return { moduleKey, levelKey };
};

const getLevelChipClasses = (level: string, categoryKey: string) => {
  const levelType = level.trim().toUpperCase();

  if (levelType === "VIEWER") {
    return "border-slate-300 bg-slate-100 text-slate-500";
  }

  if (categoryKey === "TRANSACTIONAL") {
    if (levelType === "MANAGER") return "border-blue-300 bg-blue-100 text-blue-600";
    if (levelType === "USER") return "border-blue-200 bg-blue-50 text-blue-500";
  } else if (categoryKey === "OPERATIONAL") {
    if (levelType === "MANAGER") return "border-amber-300 bg-amber-100 text-amber-600";
    if (levelType === "USER") return "border-amber-200 bg-amber-50 text-amber-500";
  } else if (categoryKey === "SYSTEM_ACCESS") {
    if (levelType === "MANAGER") return "border-emerald-300 bg-emerald-100 text-emerald-600";
    if (levelType === "USER") return "border-emerald-200 bg-emerald-50 text-emerald-500";
  }

  if (levelType === "MANAGER") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-slate-50 text-slate-500";
};

const buildRolesView = (roles: RoleRecord[]) => {
  const activeRoles = roles.filter((role) => role.isActive);
  const levelSet = new Set<string>();
  const categoryMap = new Map<string, Map<string, Record<string, string>>>();
  const primaryModules = new Set<string>();

  activeRoles.forEach((role) => {
    const categoryKey = role.category.trim().toUpperCase();
    const fallbackLevel = role.permissionLevel.trim().toUpperCase();
    const { moduleKey, levelKey } = parseRoleCode(role.roleCode, fallbackLevel);
    levelSet.add(levelKey);

    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, new Map());
    }

    const moduleMap = categoryMap.get(categoryKey);
    if (!moduleMap) return;

    if (!moduleMap.has(moduleKey)) {
      moduleMap.set(moduleKey, {});
    }

    const row = moduleMap.get(moduleKey);
    if (!row) return;
    row[levelKey] = role.roleCode;
    if (role.accessType === "PRIMARY") {
      primaryModules.add(`${categoryKey}::${moduleKey}`);
    }
  });

  const levelOrder = ["MANAGER", "USER", "VIEWER"];
  const levels = Array.from(levelSet).sort((left, right) => {
    const leftIndex = levelOrder.indexOf(left);
    const rightIndex = levelOrder.indexOf(right);

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return left.localeCompare(right);
  });

  const categories: RoleCategory[] = Array.from(categoryMap.entries()).map(([categoryKey, modules]) => {
    const meta = getCategoryMeta(categoryKey);

    const rows = Array.from(modules.entries()).map(([moduleKey, rowLevels]) => ({
      module: formatLabel(moduleKey),
      levels: rowLevels,
      isPrimary: primaryModules.has(`${categoryKey}::${moduleKey}`),
    }));

    return {
      key: categoryKey,
      title: meta.title,
      icon: meta.icon,
      theme: meta.theme,
      rows,
    };
  });

  return { levels, categories };
};

export function RolesAllocationPanel({
  userName,
  showUserNote = false,
}: RolesAllocationPanelProps) {
  const { currentUser } = useAppContext();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const companyCode = currentUser?.companyCode?.trim().toUpperCase() ?? "";

  useEffect(() => {
    if (!companyCode) return;
    let ignore = false;

    const loadRoles = async () => {
      setIsLoading(true);
      setError("");
      try {
        const data = await getCompanyRoles(companyCode);
        if (!ignore) {
          setRoles(data);
        }
      } catch (err) {
        if (!ignore) {
          setRoles([]);
          setError(err instanceof Error ? err.message : "Failed to load roles");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadRoles();
    return () => {
      ignore = true;
    };
  }, [companyCode]);

  const { levels, categories } = useMemo(() => buildRolesView(roles), [roles]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <div className="space-y-1">
            <h2 className="text-[16px] font-bold text-slate-800 uppercase tracking-tight">
              Access Rights
            </h2>
          </div>
        </div>

        {!companyCode ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Company code is not available for loading roles.
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading roles...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Unable to load role mapping: {error}
          </div>
        ) : null}

        {!isLoading && !error && categories.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No active role mappings found.
          </div>
        ) : null}

        {categories.map((category) => (
          <div
            key={category.key}
            className={`overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm group transition-all ${category.theme.border}`}
          >
            <div className={`flex items-center gap-4 border-b border-slate-100 p-5 transition-colors ${category.theme.headerBg}`}>
              <div className={`rounded-lg p-2 ${category.theme.iconBg} ${category.theme.iconColor}`}>
                <category.icon size={16} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                  {category.title}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[26%]" />
                  {levels.map((level) => (
                    <col key={`${category.key}-col-${level}`} className="w-[24.666%]" />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500 align-middle">
                      Module
                    </th>
                    {levels.map((level) => (
                      <th
                        key={`${category.key}-${level}`}
                        className="px-3 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500 align-middle"
                      >
                        {formatLabel(level)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {category.rows.map((row) => (
                    <tr key={`${category.key}-${row.module}`} className="border-b border-slate-100 last:border-0">
                      <td className="border-l-2 border-transparent px-3 py-2.5 font-semibold text-slate-800 align-middle">
                        <span className="inline-flex max-w-full items-center whitespace-nowrap">{row.module}</span>
                      </td>
                      {levels.map((level) => {
                        const roleCode = row.levels[level];
                        return (
                          <td
                            key={`${category.key}-${row.module}-${level}`}
                            className="px-3 py-2.5 text-center align-middle"
                          >
                            {roleCode ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-block cursor-default">
                                    <div
                                      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border pointer-events-none ${getLevelChipClasses(level, category.key)}`}
                                    >
                                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="font-semibold text-xs">
                                  {formatLabel(roleCode)}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-100 bg-slate-50/50 text-slate-300">
                                    <span className="block h-[2px] w-2.5 rounded-full bg-slate-300" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Role not available
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {showUserNote && userName ? (
          <div className="rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <p className="mx-auto max-w-md text-[11px] font-medium leading-relaxed text-slate-500">
              This mapping describes global roles. Active capabilities for{" "}
              <strong>{userName}</strong> are defined specifically within the{" "}
              <span className="font-bold text-blue-600">Access Rights</span> tab.
            </p>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

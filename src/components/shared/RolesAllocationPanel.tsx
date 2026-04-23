import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Database, ShieldCheck, Workflow } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { getCompanyRoles, type RoleRecord } from "@/services/role.service";

type RoleRow = {
  module: string;
  levels: Record<string, string>;
};

type RoleCategory = {
  key: string;
  title: string;
  description: string;
  icon: typeof CreditCard;
  rows: RoleRow[];
};

const categoryMeta: Record<string, { title: string; description: string; icon: typeof CreditCard }> = {
  TRANSACTIONAL: {
    title: "Transactional Operations",
    description: "Primary cash flow and procurement lifecycle.",
    icon: CreditCard,
  },
  OPERATIONAL: {
    title: "Operational Controls",
    description: "Master data and process operations.",
    icon: Database,
  },
  SYSTEM_ACCESS: {
    title: "System Access",
    description: "Platform-level navigation and controls.",
    icon: Workflow,
  },
};

const preferredLevelOrder = ["ADMIN", "MANAGER", "USER", "VIEWER"];

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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

const buildRolesView = (roles: RoleRecord[]) => {
  const activeRoles = roles.filter((role) => role.isActive);
  const levelSet = new Set<string>();
  const categoryMap = new Map<string, Map<string, Record<string, string>>>();

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
  });

  const levels = Array.from(levelSet).sort((left, right) => {
    const leftIndex = preferredLevelOrder.indexOf(left);
    const rightIndex = preferredLevelOrder.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }
    return left.localeCompare(right);
  });

  const categories: RoleCategory[] = Array.from(categoryMap.entries())
    .map(([categoryKey, modules]) => {
      const meta = categoryMeta[categoryKey] ?? {
        title: formatLabel(categoryKey),
        description: "Role mapping provided by backend.",
        icon: ShieldCheck,
      };

      const rows = Array.from(modules.entries())
        .map(([moduleKey, rowLevels]) => ({
          module: formatLabel(moduleKey),
          levels: rowLevels,
        }))
        .sort((left, right) => left.module.localeCompare(right.module));

      return {
        key: categoryKey,
        title: meta.title,
        description: meta.description,
        icon: meta.icon,
        rows,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));

  return { levels, categories };
};

type RolesAllocationPanelProps = {
  userName?: string;
  showUserNote?: boolean;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="space-y-1">
          <h2 className="text-[16px] font-bold text-slate-800 uppercase tracking-tight">
            Functional Rights Mapping
          </h2>
          <p className="text-[12px] text-slate-500">
            Core action guide by departmental access levels.
          </p>
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
          className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm group"
        >
          <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/50 p-4 transition-colors group-hover:bg-slate-50">
            <div className="rounded-lg border border-slate-100 bg-white p-2 text-blue-500 shadow-sm">
              <category.icon size={16} />
            </div>
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-800">
                {category.title}
              </h3>
              <p className="text-[11px] font-medium text-slate-400">
                {category.description}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                    Module
                  </th>
                  {levels.map((level) => (
                    <th
                      key={`${category.key}-${level}`}
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                    >
                      {formatLabel(level)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {category.rows.map((row) => (
                  <tr key={`${category.key}-${row.module}`} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-700">{row.module}</td>
                    {levels.map((level) => {
                      const roleCode = row.levels[level];
                      return (
                        <td key={`${category.key}-${row.module}-${level}`} className="px-4 py-3 text-center">
                          {roleCode ? (
                            <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              <Check size={12} />
                              {roleCode}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
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
  );
}

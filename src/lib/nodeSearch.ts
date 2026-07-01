import { formatNodePathDisplay } from "@/lib/nodePath";

type SearchableNodeFields = {
  nodeName?: string | null;
  nodePath?: string | null;
  nodeType?: string | null;
  companyName?: string | null;
  companyCode?: string | null;
  extraValues?: Array<string | null | undefined>;
};

const normalizeSearchValue = (value?: string | null) => String(value ?? "").trim().toLowerCase();

export const matchesNodeSearchQuery = (fields: SearchableNodeFields, query: string) => {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  const nodePath = String(fields.nodePath ?? "").trim();
  const nodePathSegments = nodePath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const searchableValues = [
    fields.nodeName,
    fields.nodeType,
    fields.companyName,
    fields.companyCode,
    nodePath,
    nodePathSegments.join(" "),
    nodePath ? formatNodePathDisplay(nodePath) : "",
    nodePath ? formatNodePathDisplay(nodePath, { excludeRoot: true }) : "",
    ...(fields.extraValues ?? []),
  ]
    .map(normalizeSearchValue)
    .filter(Boolean);

  return searchableValues.some((value) => value.includes(normalizedQuery));
};

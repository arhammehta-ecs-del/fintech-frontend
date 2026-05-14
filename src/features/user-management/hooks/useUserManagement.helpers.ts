export const normalizeCompact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const normalizeLoose = (value: string) => value.toLowerCase().trim().replace(/\s+/g, " ");

export const extractDigits = (value: string): string[] => {
  const matches = value.match(/\d+/g);
  return matches ? [...matches] : [];
};

export const splitAlphaNumericTokens = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);

export const isWithinTwoEdits = (left: string, right: string) => {
  if (!left || !right) return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > 2) return false;

  const prev = Array.from({ length: bLen + 1 }, (_, idx) => idx);
  for (let i = 1; i <= aLen; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= bLen; j += 1) {
      const temp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + cost);
      diagonal = temp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > 2) return false;
  }
  return prev[bLen] <= 2;
};

type ApiPathTextProps = {
  path: string;
  maxWidthClassName?: string;
  textClassName?: string;
  compactThreshold?: number;
};

export default function ApiPathText({
  path,
  maxWidthClassName = "max-w-[165px]",
  textClassName = "text-[11px]",
  compactThreshold = 24,
}: ApiPathTextProps) {
  const text = path || "-";
  const needsMarquee = text.length > compactThreshold;

  if (!needsMarquee) {
    return (
      <span className={`${maxWidthClassName} truncate font-mono ${textClassName}`}>
        {text}
      </span>
    );
  }

  const parts = text.split("/");
  let lastPart = "";
  let firstPart = text;

  if (parts.length > 1) {
    lastPart = `/${parts.pop()}`;
    firstPart = parts.join("/");
  }

  return (
    <div className={`relative flex w-full items-center overflow-hidden font-mono ${textClassName} ${maxWidthClassName}`}>
      <span className="flex w-full items-center transition-opacity duration-300 group-hover:opacity-0">
        <span className="truncate">{firstPart}</span>
        <span className="shrink-0">{lastPart}</span>
      </span>
      <div className="absolute inset-0 flex items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="api-marquee-wrap w-full">
          <span className="api-marquee-track group-hover:animate-[api-marquee_9s_linear_infinite]">
            <span>{text}</span>
            <span className="px-6">{text}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

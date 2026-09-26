import { Plus } from "@phosphor-icons/react/dist/ssr";

const MARKS = [
  "left-2 top-2",
  "left-1/2 top-2 -translate-x-1/2",
  "right-2 top-2",
  "left-2 bottom-2",
  "left-1/2 bottom-2 -translate-x-1/2",
  "right-2 bottom-2",
];

/** Viewport registration marks and film grain, fixed above all content. */
export function Chrome() {
  return (
    <div aria-hidden>
      <div className="grain" />
      <div className="pointer-events-none fixed inset-0 z-50 hidden md:block">
        {MARKS.map((pos) => (
          <Plus key={pos} size={14} weight="light" className={`absolute text-fg/60 ${pos}`} />
        ))}
      </div>
    </div>
  );
}

/** Label with a hover roll. Parent must be an <a> or <button>. */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span data-text={children}>{children}</span>
    </span>
  );
}

import { Fragment } from "react";

/** Renders `**key facts**` from dictionary strings as bold text; everything else stays plain. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

/** Makes the first occurrence of `term` bold inside plain text (e.g. the university name in a quote). */
export function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.indexOf(term) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-semibold text-foreground">{term}</strong>
      {text.slice(at + term.length)}
    </>
  );
}

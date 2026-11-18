import { Fragment } from "react";

/** Turns *these words* into the accent italic. Used for the guides, whose text is plain data. */
export function emph(text: string) {
  return text.split(/\*([^*]+)\*/g).map((part, i) => (i % 2 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>));
}

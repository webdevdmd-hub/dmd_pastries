/**
 * The start of a note, for naming it in a delete confirmation: enough to tell
 * two notes apart, short enough for one line of the dialog. Whitespace runs
 * collapse so a multi-line note reads as one line.
 */
export function notePreview(note: string, maxLength = 60): string {
  const text = note.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

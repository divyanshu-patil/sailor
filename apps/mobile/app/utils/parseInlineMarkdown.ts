type Segment = { text: string; bold: boolean; italic: boolean };

export function parseInlineMarkdown(line: string): Segment[] {
  const segments: Segment[] = [];
  // matches **bold**, *italic*, or plain text
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|([^*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match[1] !== undefined) {
      segments.push({ text: match[1], bold: true, italic: false });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: false, italic: true });
    } else if (match[3] !== undefined) {
      segments.push({ text: match[3], bold: false, italic: false });
    }
  }
  return segments;
}

export function elementSelector(element: Element): string {
  const escape = (value: string): string =>
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  if (element.id) return `#${escape(element.id)}`;
  const testId = element.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && parts.length < 4) {
    let part = current.tagName.toLowerCase();
    const classes = Array.from(current.classList).slice(0, 2);
    if (classes.length) part += `.${classes.map(escape).join('.')}`;
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

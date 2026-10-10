export function plural(
  count: number,
  singular: string,
  pluralForm: string = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
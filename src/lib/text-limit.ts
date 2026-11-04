// Count Han characters individually so unspaced Chinese text is bounded too.
export function textWords(value: string) {
  return [...value.matchAll(/[\p{Script=Han}]|[^\s\p{Script=Han}]+/gu)];
}

export function limitWords(value: string, max: number) {
  const words = textWords(value);
  return words.length > max ? value.slice(0, words[max].index).trimEnd() : value;
}

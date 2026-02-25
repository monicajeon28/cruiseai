export function dday(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

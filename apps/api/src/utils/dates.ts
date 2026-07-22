export function now() {
  return new Date();
}

export function secondsSince(date: Date) {
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
}

export function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

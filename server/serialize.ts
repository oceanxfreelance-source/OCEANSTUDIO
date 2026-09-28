/** Convert Prisma rows (BigInt sizes, Dates) into plain JSON-safe objects for client components. */
export function plain<T>(value: T): Jsonify<T> {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}

export type Jsonify<T> = T extends bigint
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;

declare module "papaparse" {
  export type ParseConfig = {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
    dynamicTyping?: boolean;
    transformHeader?: (header: string, index: number) => string;
  };

  export type ParseResult<T = unknown> = {
    data: T[];
    errors: Array<{ message: string }>;
    meta: Record<string, unknown>;
  };

  export function parse<T = unknown>(input: string, config?: ParseConfig): ParseResult<T>;
  export function unparse(input: unknown[] | Record<string, unknown>): string;
}

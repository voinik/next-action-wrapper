export const isError = (e: unknown): e is Error => e instanceof Error;
export const DEFAULT_SERVER_ERROR = "Something went wrong while executing the server action";

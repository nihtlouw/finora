export function normalizePostgresConnectionUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") return connectionString;
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  } catch {
    return connectionString;
  }
}

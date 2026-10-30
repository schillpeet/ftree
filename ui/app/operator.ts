import { connection } from 'next/server';

// Who runs this instance, from the server's environment (`operator.name`/`operator.email` in the Helm chart).
// `connection()` makes the caller render per request, so the values are read at runtime and never baked into the
// build; only server components may call this. Unset or empty values come back as undefined.
export async function operator() {
  await connection();
  return { name: process.env.OPERATOR_NAME || undefined, email: process.env.OPERATOR_EMAIL || undefined };
}

import "server-only";
import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  defaultLocale,
  getDictionary,
  isLocale,
  type Locale,
} from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getServerDictionary() {
  return getDictionary(await getLocale());
}

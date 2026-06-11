import "server-only";
import { getDictionary, type Locale } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  return "en";
}

export async function getServerDictionary() {
  return getDictionary();
}

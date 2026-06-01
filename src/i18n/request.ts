import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/**
 * Cookie-based locale: `/` and `/login` etc. live at the root with no
 * /en or /ar prefix in the URL. The locale comes from the NEXT_LOCALE
 * cookie set by <LanguageToggle/>. This avoids needing an `[locale]`
 * dynamic segment in the app router tree (which would require
 * restructuring every portal page).
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get('NEXT_LOCALE')?.value;
  const locale =
    cookieLocale && routing.locales.includes(cookieLocale as 'en' | 'ar')
      ? cookieLocale
      : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

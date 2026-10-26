import { getTranslations } from "next-intl/server";

// Public, no auth — required by Google's OAuth consent screen (Branding ->
// Privacy policy URL) before the app can be switched from "Testing" to
// "In production".
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-base text-gray-600">{t("intro")}</p>

      <h2 className="mb-2 mt-6 text-xl font-semibold">{t("collectedTitle")}</h2>
      <ul className="mb-6 list-disc pl-5 text-base text-gray-700">
        <li>{t("collectedAccount")}</li>
        <li>{t("collectedGoogle")}</li>
        <li>{t("collectedContent")}</li>
      </ul>

      <h2 className="mb-2 mt-6 text-xl font-semibold">{t("useTitle")}</h2>
      <p className="mb-6 text-base text-gray-700">{t("useBody")}</p>

      <h2 className="mb-2 mt-6 text-xl font-semibold">{t("sharingTitle")}</h2>
      <ul className="mb-6 list-disc pl-5 text-base text-gray-700">
        <li>{t("sharingStripe")}</li>
        <li>{t("sharingAws")}</li>
        <li>{t("sharingResend")}</li>
        <li>{t("sharingGoogle")}</li>
      </ul>
      <p className="mb-6 text-base text-gray-700">{t("noSelling")}</p>

      <h2 className="mb-2 mt-6 text-xl font-semibold">{t("rightsTitle")}</h2>
      <p className="mb-6 text-base text-gray-700">{t("rightsBody")}</p>

      <h2 className="mb-2 mt-6 text-xl font-semibold">{t("contactTitle")}</h2>
      <p className="text-base text-gray-700">{t("contactBody")}</p>
    </main>
  );
}

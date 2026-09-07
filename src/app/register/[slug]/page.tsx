import { getPublicCampaign } from "@/app/actions";
import { RegistrationForm } from "@/features/registration/registration-form";
export const dynamic = "force-dynamic";
export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campaign = await getPublicCampaign(slug);
  if (!campaign)
    return (
      <main className="public-page">
        <div className="public-brand brand">
          <span className="brand-mark">✳</span>змістовно.
        </div>
        <div className="public-closed">
          <span className="success-symbol">♡</span>
          <h1>Цей набір наразі закрито</h1>
          <p>
            Реєстрація ще не розпочалася або вже завершилася.
            <br />
            Зверніться до команди школи, щоб дізнатися про наступний набір.
          </p>
        </div>
      </main>
    );
  return <RegistrationForm campaign={campaign} />;
}

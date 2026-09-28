import V2StoreSettingsForm from "@/components/V2StoreSettingsForm";

type Props = {
  params: Promise<{ cardCode: string }>;
};

export default async function StoreSettingsPage({ params }: Props) {
  const { cardCode } = await params;
  const code = decodeURIComponent(cardCode).trim().toUpperCase();

  return <V2StoreSettingsForm cardCode={code} />;
}

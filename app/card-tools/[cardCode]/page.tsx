import V2CardTools from "@/components/V2CardTools";

export default async function CardToolsPage({
  params,
}: {
  params: Promise<{ cardCode: string }>;
}) {
  const { cardCode } = await params;
  const code = decodeURIComponent(cardCode).trim().toUpperCase();
  return <V2CardTools cardCode={code} />;
}

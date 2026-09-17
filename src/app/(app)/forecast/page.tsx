import type { Metadata } from "next";
import ForecastBoard from "@/components/forecast/ForecastBoard";
import NoAccess from "@/components/NoAccess";
import { canEditForecast, hasModuleAccess } from "@/lib/access";

export const metadata: Metadata = { title: "Forecast · Join4 PMO" };

export default async function ForecastPage() {
  const allowed = await hasModuleAccess("forecast");
  if (!allowed) return <NoAccess moduleLabel="Forecast" />;
  const canEdit = await canEditForecast();
  return <ForecastBoard canEdit={canEdit} />;
}

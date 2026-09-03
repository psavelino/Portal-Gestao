import type { Metadata } from "next";
import ForecastBoard from "@/components/forecast/ForecastBoard";

export const metadata: Metadata = { title: "Forecast · Join4 PMO" };

export default function ForecastPage() {
  return <ForecastBoard />;
}

import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = { title: "Criar conta · Join4 PMO" };

export default function SignupPage() {
  const requiresAccessCode = Boolean(process.env.SIGNUP_CODE?.trim());
  return <SignupForm requiresAccessCode={requiresAccessCode} />;
}

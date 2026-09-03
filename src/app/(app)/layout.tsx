import { auth } from "@/auth";
import NavHeader from "@/components/NavHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-full flex flex-col">
      <NavHeader
        userName={session?.user?.name}
        userEmail={session?.user?.email}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}

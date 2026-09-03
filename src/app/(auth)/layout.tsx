export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col bg-bg">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-2 justify-center mb-8">
            <span className="w-2.5 h-2.5 rounded-full bg-verde" />
            <span className="font-condensed font-bold text-[13px] tracking-[0.14em] uppercase text-ink-secondary">
              Join4 &middot; PMO
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

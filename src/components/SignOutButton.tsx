"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs font-semibold text-ink-secondary hover:text-verde transition-colors"
    >
      Sair
    </button>
  );
}

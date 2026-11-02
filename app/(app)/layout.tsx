import Link from "next/link";
import { signOut } from "@/app/auth-actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <nav>
          <Link href="/tracker" className="brand">
            NEPSE tracker
          </Link>
          <Link href="/tracker">Tracker</Link>
          <Link href="/snapshot">Snapshot</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <form action={signOut}>
          <button className="btn" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
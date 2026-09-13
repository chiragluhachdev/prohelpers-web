"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Avatar, Button, Spinner } from "@/components/ui";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "M3 12h7V3H3v9Zm0 9h7v-7H3v7Zm11 0h7V12h-7v9Zm0-18v7h7V3h-7Z" },
  { href: "/admin/helpers", label: "Helpers", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/admin/customers", label: "Customers", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  { href: "/admin/services", label: "Services", icon: "M20.6 8.4a5 5 0 0 1-6.6 6.6l-6 6a2.1 2.1 0 0 1-3-3l6-6a5 5 0 0 1 6.6-6.6l-3 3 .5 3 3 .5 3-3Z" },
  { href: "/admin/finance", label: "Finance", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { href: "/admin/bookings", label: "Bookings", icon: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" },
  { href: "/admin/settings", label: "Settings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/admin/login");
  }, [user, loading, router]);

  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      {/* ------------------------------------------------------- sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo size={30} />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Pro Helper</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-0.5 flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-forest-50 text-forest-800" : "text-ink-soft hover:bg-sunken hover:text-ink"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={active ? "text-forest-600" : "text-ink-muted"}
                >
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
            <Avatar name={user.name} size={30} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
              <p className="truncate text-[11px] text-ink-muted">{user.email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </aside>

      {/* -------------------------------------------------- mobile header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 overflow-x-auto border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
          <Logo size={26} />
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-[13px] font-medium ${
                pathname.startsWith(item.href) ? "bg-forest-50 text-forest-800" : "text-ink-soft"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

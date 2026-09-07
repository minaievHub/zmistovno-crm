"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  Compass,
  BookOpen,
  UsersRound,
  Megaphone,
  Archive,
  Settings,
  Search,
  LogOut,
  Menu,
  ChevronRight,
  GraduationCap,
  X,
  Send,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { Profile } from "@/types/crm";
const nav = [
  ["/", "Головна", LayoutDashboard],
  ["/leads", "Заявки", Inbox],
  ["/directions", "Напрямки", Compass],
  ["/courses", "Курси", BookOpen],
  ["/groups", "Групи", UsersRound],
  ["/campaigns", "Набори", Megaphone],
  ["/students", "Учні", GraduationCap],
  ["/telegram", "Telegram", Send],
  ["/archive", "Архів", Archive],
] as const;
export function Shell({
  children,
  profile,
  newCount,
}: {
  children: React.ReactNode;
  profile: Profile;
  newCount: number;
}) {
  const path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const title =
    nav.find(([href]) =>
      href === "/" ? path === "/" : path.startsWith(href),
    )?.[1] || "Налаштування";
  return (
    <div className="app-shell">
      {open && (
        <button
          className="mobile-overlay"
          aria-label="Закрити меню"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={"sidebar " + (open ? "sidebar-open" : "")}>
        <Link className="brand" href="/">
          <span className="brand-mark">✳</span>змістовно
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">З</span>
          <div>
            <strong>Онлайн-школа</strong>
            <small>Робочий простір</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-caption">КЕРУВАННЯ ШКОЛОЮ</div>
        <nav>
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={
                (href === "/" ? path === "/" : path.startsWith(href))
                  ? "nav-active"
                  : ""
              }
            >
              <Icon size={19} />
              {label}
              {href === "/leads" && newCount > 0 && (
                <span className="nav-count">{newCount}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="school-note">
            <span>✦</span>
            <strong>
              Більше змісту.
              <br />
              Більше можливостей.
            </strong>
            <p>Маленькі кроки до великого майбутнього.</p>
          </div>
          <Link
            href="/settings"
            className={
              "settings-link " + (path === "/settings" ? "nav-active" : "")
            }
          >
            <Settings size={19} />
            Налаштування
          </Link>
          <div className="profile">
            <span className="avatar">{profile.full_name.slice(0, 1)}</span>
            <div>
              <strong>{profile.full_name}</strong>
              <small>
                {profile.role === "admin" ? "Адміністратор" : "Менеджер"}
              </small>
            </div>
            <form action={logoutAction}>
              <button className="icon-button" aria-label="Вийти">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label="Меню"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Робочий простір</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/leads?q=" + encodeURIComponent(search));
            }}
          >
            <Search size={17} />
            <input
              aria-label="Пошук у CRM"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Знайти дитину або контакт…"
            />
            <kbd>↵</kbd>
          </form>
          <span className="top-avatar">{profile.full_name.slice(0, 1)}</span>
        </header>
        <main className="main-content">{children}</main>
        <footer className="app-footer">
          Змістовно · Простір для зростання{" "}
          <span>Зроблено з турботою про команду ♡</span>
        </footer>
      </div>
    </div>
  );
}

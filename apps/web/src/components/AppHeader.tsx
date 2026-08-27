import { NavLink } from "react-router";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "text-sm font-medium text-slate-900 underline decoration-2 underline-offset-4"
    : "text-sm font-medium text-slate-600 hover:text-slate-900";

export const AppHeader = () => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-4">
      <p className="text-sm font-semibold tracking-tight text-slate-900">Hotel Chaos Simulator</p>
      <nav aria-label="Main">
        <ul className="flex gap-4">
          <li>
            <NavLink to="/" end className={navLinkClassName}>
              Book
            </NavLink>
          </li>
          <li>
            <NavLink to="/chaos" className={navLinkClassName}>
              Chaos Control
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>
);

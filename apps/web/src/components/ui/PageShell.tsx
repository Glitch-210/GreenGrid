import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "./Button";

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">wattshare</h1>
          <p className="text-sm text-neutral-400">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-neutral-400">{user.displayAlias}</span>}
          <Button
            className="bg-neutral-800 text-neutral-100"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}

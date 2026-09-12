import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">PROFILE</h1>
      <p className="mb-4 font-mono text-xs uppercase tracking-wider text-on-surface-variant">Account &amp; grid identity</p>

      <Card className="max-w-md">
        <div className="flex items-center gap-3 border-b-3 border-black pb-3">
          <img
            src="/avatar-placeholder.png"
            alt="Profile"
            className="h-14 w-14 border-3 border-black object-cover"
          />
          <div>
            <p className="font-display text-lg font-bold">{user?.name ?? "—"}</p>
            <p className="font-mono text-xs uppercase text-on-surface-variant">{user?.displayAlias ?? "—"}</p>
          </div>
        </div>

        <dl className="mt-3 flex flex-col gap-2 font-mono text-sm">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Email</dt>
            <dd>{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Role</dt>
            <dd>{user?.role ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Status</dt>
            <dd>{user?.status ?? "—"}</dd>
          </div>
          {user?.walletAddress && (
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Wallet</dt>
              <dd className="truncate">{user.walletAddress}</dd>
            </div>
          )}
        </dl>

        <Button
          variant="fault"
          className="mt-4 w-full"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Log out
        </Button>
      </Card>
    </div>
  );
}

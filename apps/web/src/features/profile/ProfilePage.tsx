import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { useApiQuery } from "../../hooks/useApi";
import { Role } from "@wattshare/shared";

interface UserMeData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  status: string;
  displayAlias: string;
  walletAddress?: string | null;
  createdAt: string;
  meters: {
    id: string;
    meterNumber: string;
    meterType: string;
    status: string;
    ratedKw: string;
    installedAt: string;
    gridZone: {
      zoneCode: string;
      name: string;
    };
  }[];
}

const DEMO_PROFILES = [
  { role: Role.PROSUMER, label: "Prosumer 1 (Solar-Pro-101)", email: "prosumer1@demo.in", icon: "⚡" },
  { role: Role.CONSUMER, label: "Consumer 1 (Buyer Node)", email: "consumer1@demo.in", icon: "🛒" },
  { role: Role.UTILITY, label: "Utility (DISCOM Operator)", email: "utility@demo.in", icon: "🏢" },
  { role: Role.REGULATOR, label: "Regulator (GERC Auditor)", email: "regulator@demo.in", icon: "⚖️" },
  { role: Role.ADMIN, label: "Admin (Platform Controls)", email: "admin@demo.in", icon: "🛠️" },
];

export default function ProfilePage() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const { data: me } = useApiQuery<UserMeData>(["users", "me"], "/users/me");
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  async function handleSwitchProfile(email: string, targetRole: Role) {
    setSwitchingTo(email);
    try {
      await login(email, "demo1234");
      navigate(`/${targetRole.toLowerCase()}`);
    } finally {
      setSwitchingTo(null);
    }
  }

  const role = user?.role as Role;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">ACCOUNT PROFILE</h1>
        <p className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
          Identity, connected grid hardware &amp; role permissions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main User Card */}
        <Card className="border-3 border-black bg-white shadow-hard lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-black pb-4">
            <div className="flex items-center gap-3">
              <img
                src="/avatar-placeholder.png"
                alt="Profile Avatar"
                className="h-16 w-16 border-3 border-black object-cover shadow-hard-sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-xl font-bold">{user?.name ?? "—"}</p>
                  <StatusBadge status="live">{user?.status ?? "ACTIVE"}</StatusBadge>
                </div>
                <p className="font-mono text-xs font-bold text-solar-dark">{user?.displayAlias ?? "—"}</p>
              </div>
            </div>

            <span className="border-2 border-black bg-black px-3 py-1 font-mono text-xs font-bold uppercase text-white shadow-hard-sm">
              Role: {user?.role}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-2">
            <div className="border-2 border-black/20 p-2.5 bg-surface/40">
              <dt className="text-on-surface-variant uppercase font-bold">Email Address</dt>
              <dd className="mt-0.5 text-sm font-bold text-black">{user?.email ?? "—"}</dd>
            </div>

            <div className="border-2 border-black/20 p-2.5 bg-surface/40">
              <dt className="text-on-surface-variant uppercase font-bold">Assigned Role</dt>
              <dd className="mt-0.5 text-sm font-bold text-black">{user?.role ?? "—"}</dd>
            </div>

            <div className="border-2 border-black/20 p-2.5 bg-surface/40 sm:col-span-2">
              <dt className="text-on-surface-variant uppercase font-bold">Custodial Blockchain Wallet</dt>
              <dd className="mt-0.5 break-all font-mono text-xs font-bold text-black">
                {user?.walletAddress ?? "0x413a3Fed0435d11Afac103A55a7BB0460adF6a48 (Simulated Mode)"}
              </dd>
            </div>

            <div className="border-2 border-black/20 p-2.5 bg-surface/40">
              <dt className="text-on-surface-variant uppercase font-bold">Account Created</dt>
              <dd className="mt-0.5 font-bold text-black">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Active Seed"}
              </dd>
            </div>

            <div className="border-2 border-black/20 p-2.5 bg-surface/40">
              <dt className="text-on-surface-variant uppercase font-bold">Platform Authorization</dt>
              <dd className="mt-0.5 font-bold text-solar-dark">✓ Verified Peer-to-Peer Actor</dd>
            </div>
          </dl>

          {/* Connected Grid Hardware (Smart Meters) */}
          <div className="mt-6 border-t-3 border-black pt-4">
            <h2 className="font-display text-base font-bold uppercase">Connected Grid Hardware</h2>
            <p className="mb-3 font-mono text-xs text-on-surface-variant">
              Smart IoT meters transmitting 15-minute generation and consumption telemetry
            </p>

            {me?.meters && me.meters.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {me.meters.map((meter) => (
                  <div
                    key={meter.id}
                    className="border-2 border-black bg-surface p-3 shadow-hard-sm font-mono text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{meter.meterNumber}</span>
                      <StatusBadge status={meter.status === "ACTIVE" ? "live" : "fault"}>
                        {meter.status}
                      </StatusBadge>
                    </div>
                    <p className="text-on-surface-variant">
                      Type: <span className="font-bold text-black">{meter.meterType}</span> · Inverter:{" "}
                      <span className="font-bold text-black">{meter.ratedKw} kW</span>
                    </p>
                    <p className="text-on-surface-variant">
                      Zone: <span className="font-bold text-black">{meter.gridZone.name} ({meter.gridZone.zoneCode})</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-black/40 bg-surface/40 p-3 font-mono text-xs text-on-surface-variant">
                {role === Role.UTILITY && "DISCOM Substation Node — Monitors all grid zones and settlement queues."}
                {role === Role.REGULATOR && "Regulatory Oversight Node — GERC statutory auditing & invariant enforcement."}
                {role === Role.ADMIN && "System Root Authority — Global parameter control & simulator engine."}
                {role !== Role.UTILITY && role !== Role.REGULATOR && role !== Role.ADMIN && "No hardware meter currently bound to this user profile."}
              </div>
            )}
          </div>

          {/* Role Shortcut Links */}
          <div className="mt-6 flex flex-wrap gap-2 border-t-3 border-black pt-4">
            <Link to={`/${role?.toLowerCase()}`}>
              <Button variant="solar">Go to {role} Dashboard</Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="neutral">Browse Marketplace</Button>
            </Link>
            <Button
              variant="fault"
              className="ml-auto"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Log out
            </Button>
          </div>
        </Card>

        {/* Demo Profile Switcher */}
        <Card className="border-3 border-black bg-[#1b1b1b] text-white shadow-hard flex flex-col justify-between">
          <div>
            <div className="border-b-2 border-white/20 pb-2">
              <span className="border border-white/40 bg-solar px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black">
                Demo Testing Feature
              </span>
              <h2 className="mt-2 font-display text-lg font-bold">SWITCH DEMO PROFILE</h2>
              <p className="font-mono text-xs text-white/70">
                Instantly switch roles to test and verify every profile view:
              </p>
            </div>

            <div className="mt-4 space-y-2 font-mono text-xs">
              {DEMO_PROFILES.map((p) => {
                const isCurrent = user?.email === p.email;
                const isBusy = switchingTo === p.email;

                return (
                  <button
                    key={p.email}
                    onClick={() => handleSwitchProfile(p.email, p.role)}
                    disabled={isCurrent || !!switchingTo}
                    className={`w-full flex items-center justify-between p-2.5 border-2 text-left transition-all ${
                      isCurrent
                        ? "border-solar bg-solar/20 text-white cursor-default"
                        : "border-white/30 bg-black/40 hover:bg-white/10 hover:border-white text-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </div>
                      <span className="text-[10px] text-white/60">{p.email}</span>
                    </div>

                    <span className="text-[10px] font-bold uppercase">
                      {isCurrent ? "Active" : isBusy ? "Switching…" : "Switch →"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t-2 border-white/20 pt-3 font-mono text-[11px] text-white/60">
            Default password for all seeded accounts: <span className="font-bold text-solar">demo1234</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

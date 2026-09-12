import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Role } from "@wattshare/shared";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Logo } from "../../components/layout/Logo";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.PROSUMER);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const user = await register(name, email, password, role);
      navigate(`/${user.role.toLowerCase()}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Registration failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-4 flex items-center gap-2">
          <Logo size={40} />
          <h1 className="font-display text-xl font-extrabold tracking-tight">CREATE ACCOUNT</h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            className="border-3 border-black bg-white px-3 py-2 font-mono text-sm focus:shadow-hard-sm focus:outline-none"
            placeholder="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border-3 border-black bg-white px-3 py-2 font-mono text-sm focus:shadow-hard-sm focus:outline-none"
            placeholder="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="border-3 border-black bg-white px-3 py-2 font-mono text-sm focus:shadow-hard-sm focus:outline-none"
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className="border-3 border-black bg-white px-3 py-2 font-mono text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value={Role.PROSUMER}>Prosumer</option>
            <option value={Role.CONSUMER}>Consumer</option>
          </select>
          {error && <p className="font-mono text-sm text-fault">{error}</p>}
          <Button type="submit" variant="solar">
            Register
          </Button>
        </form>
        <p className="mt-4 font-mono text-sm text-on-surface-variant">
          Have an account?{" "}
          <Link to="/login" className="font-bold text-solar-dark underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Role } from "@wattshare/shared";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

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
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-xl font-semibold">Create account</h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" placeholder="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value={Role.PROSUMER}>Prosumer</option>
            <option value={Role.CONSUMER}>Consumer</option>
          </select>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit">Register</Button>
        </form>
        <p className="mt-4 text-sm text-neutral-400">
          Have an account? <Link to="/login" className="text-energy-green">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}

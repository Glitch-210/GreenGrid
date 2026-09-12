import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Logo } from "../../components/layout/Logo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const user = await login(email, password);
      navigate(`/${user.role.toLowerCase()}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Login failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <Card className="w-full max-w-sm">
        <div className="mb-4 flex items-center gap-2">
          <Logo size={40} />
          <h1 className="font-display text-xl font-extrabold tracking-tight">GREENGRID — SIGN IN</h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
          {error && <p className="font-mono text-sm text-fault">{error}</p>}
          <Button type="submit" variant="solar">
            Sign in
          </Button>
        </form>
        <p className="mt-4 font-mono text-sm text-on-surface-variant">
          No account?{" "}
          <Link to="/register" className="font-bold text-solar-dark underline">
            Register
          </Link>
        </p>
      </Card>
    </div>
  );
}

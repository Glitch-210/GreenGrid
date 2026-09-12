import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import ProsumerDashboard from "./features/prosumer/ProsumerDashboard";
import ProsumerCredits from "./features/prosumer/ProsumerCredits";
import ProsumerSell from "./features/prosumer/ProsumerSell";
import ConsumerDashboard from "./features/consumer/ConsumerDashboard";
import ConsumerMarketplace from "./features/consumer/ConsumerMarketplace";
import ConsumerCheckout from "./features/consumer/ConsumerCheckout";
import TransactionDetail from "./features/consumer/TransactionDetail";
import UtilityDashboard from "./features/utility/UtilityDashboard";
import AdminDashboard from "./features/admin/AdminDashboard";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/prosumer" element={<RequireAuth><ProsumerDashboard /></RequireAuth>} />
      <Route path="/prosumer/credits" element={<RequireAuth><ProsumerCredits /></RequireAuth>} />
      <Route path="/prosumer/sell" element={<RequireAuth><ProsumerSell /></RequireAuth>} />

      <Route path="/consumer" element={<RequireAuth><ConsumerDashboard /></RequireAuth>} />
      <Route path="/consumer/marketplace" element={<RequireAuth><ConsumerMarketplace /></RequireAuth>} />
      <Route path="/consumer/checkout" element={<RequireAuth><ConsumerCheckout /></RequireAuth>} />
      <Route path="/consumer/transactions/:id" element={<RequireAuth><TransactionDetail /></RequireAuth>} />

      <Route path="/utility" element={<RequireAuth><UtilityDashboard /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

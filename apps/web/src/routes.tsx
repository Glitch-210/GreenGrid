import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { AppShell } from "./components/layout/AppShell";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import ProsumerDashboard from "./features/prosumer/ProsumerDashboard";
import ProsumerCredits from "./features/prosumer/ProsumerCredits";
import ProsumerSell from "./features/prosumer/ProsumerSell";
import ConsumerDashboard from "./features/consumer/ConsumerDashboard";
import ConsumerCheckout from "./features/consumer/ConsumerCheckout";
import ConsumerTransactions from "./features/consumer/ConsumerTransactions";
import Marketplace from "./features/marketplace/Marketplace";
import SettlementDetail from "./features/transactions/SettlementDetail";
import UtilityDashboard from "./features/utility/UtilityDashboard";
import AdminDashboard from "./features/admin/AdminDashboard";
import RegulatorDashboard from "./features/regulator/RegulatorDashboard";
import ProfilePage from "./features/profile/ProfilePage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/prosumer" element={<ProsumerDashboard />} />
        <Route path="/prosumer/credits" element={<ProsumerCredits />} />
        <Route path="/prosumer/sell" element={<ProsumerSell />} />

        <Route path="/consumer" element={<ConsumerDashboard />} />
        <Route path="/consumer/checkout" element={<ConsumerCheckout />} />
        <Route path="/consumer/transactions" element={<ConsumerTransactions />} />

        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/transactions/:id" element={<SettlementDetail />} />

        <Route path="/utility" element={<UtilityDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/regulator" element={<RegulatorDashboard />} />

        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

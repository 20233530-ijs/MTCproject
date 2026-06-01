import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import SteelUsage from "../components/integrator/SteelUsage";
import { useRole } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";
import { TxPageHead, PageConnectGuard } from "../components/TxShared";

export default function UsagePage() {
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const { isAdmin, isIntegrator, effectiveRole, isLoading } = useRole();
  const hasAccess = isAdmin || isIntegrator || effectiveRole === "integrator";

  useEffect(() => {
    if (!isLoading && isConnected && !hasAccess) {
      navigate("/", { replace: true });
    }
  }, [hasAccess, isConnected, isLoading, navigate]);

  if (!isConnected || isLoading) {
    return <PageLayout><PageConnectGuard isLoading={isLoading && isConnected} /></PageLayout>;
  }

  return (
    <PageLayout>
      <TxPageHead title="사용 등록" en="markAsUsed" />
      <SteelUsage />
    </PageLayout>
  );
}

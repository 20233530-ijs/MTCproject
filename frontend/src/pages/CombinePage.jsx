import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import SteelCombine from "../components/fabricator/SteelCombine";
import { useRole } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";
import { TxPageHead, PageConnectGuard } from "../components/TxShared";

export default function CombinePage() {
  const navigate = useNavigate();
  const { isConnected } = useWallet();
  const { isAdmin, isFabricator, effectiveRole, isLoading } = useRole();
  const hasAccess = isAdmin || isFabricator || effectiveRole === "fabricator";

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
      <TxPageHead title="강재 조합" arrow="1" en="combineSteel" />
      <SteelCombine />
    </PageLayout>
  );
}

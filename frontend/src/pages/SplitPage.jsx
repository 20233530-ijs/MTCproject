import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout";
import SteelSplit from "../components/fabricator/SteelSplit";
import { useRole } from "../hooks/useRole";
import { useWallet } from "../hooks/useWallet";
import { TxPageHead, PageConnectGuard } from "../components/TxShared";

export default function SplitPage() {
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
      <TxPageHead title="강재 분할" arrow="N" en="splitSteel" />
      <SteelSplit />
    </PageLayout>
  );
}

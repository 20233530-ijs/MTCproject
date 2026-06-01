/**
 * 역할 관리 컴포넌트
 * 화면설계서 §5 기준
 *
 * - 지갑 주소 입력 + 42자 형식 프론트 검증
 * - 역할 선택 라디오 (Mill / Fabricator / Integrator)
 * - 역할 등록: grantMill / grantFabricator / grantIntegrator 트랜잭션
 * - 역할 목록: RoleGranted 이벤트 기반 (최근 2000 블록)
 * - 역할 해제: 확인 모달 → revokeMill / revokeFabricator / revokeIntegrator
 */

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useContract } from "../../hooks/useContract";
import { useWallet } from "../../hooks/useWallet";
import { useTx } from "../../contexts/TxContext";
import { CONTRACT_ADDRESS, ETHERSCAN_BASE } from "../../constants/addresses";
import { parseContractError } from "../../utils/errorMessages";
import { logTxSent, logTxConfirmed, logContractError } from "../../utils/logger";
import { shortenAddress } from "../../utils/format";

const ROLES = [
  { key: "mill",        label: "Mill (제강사)",       grant: "grantMill",        revoke: "revokeMill" },
  { key: "fabricator",  label: "Fabricator (가공사)", grant: "grantFabricator",  revoke: "revokeFabricator" },
  { key: "integrator",  label: "Integrator (통합사)", grant: "grantIntegrator",  revoke: "revokeIntegrator" },
];

// RoleGranted 이벤트에서 쓰이는 역할 해시 → role 키 매핑
const ROLE_HASH_TO_KEY = {
  [ethers.keccak256(ethers.toUtf8Bytes("MILL_ROLE"))]:        "mill",
  [ethers.keccak256(ethers.toUtf8Bytes("FABRICATOR_ROLE"))]:  "fabricator",
  [ethers.keccak256(ethers.toUtf8Bytes("INTEGRATOR_ROLE"))]:  "integrator",
};

/** 주소 형식 검증: 0x로 시작 + 42자 */
function isValidAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export default function RoleManager() {
  const [address, setAddress]       = useState("");
  const [addrError, setAddrError]   = useState("");
  const [selectedRole, setSelectedRole] = useState("mill");
  const [isSending, setIsSending]   = useState(false);
  const [roleList, setRoleList]     = useState([]); // { address, roleKey, blockNumber, txHash }
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null); // { address, roleKey } — 확인 모달용
  const [activeTab, setActiveTab]   = useState("register");

  const { readContract, getSignedContract, provider } = useContract();
  const { isConnected } = useWallet();
  const { pushTx, updateTx } = useTx();

  // ── 역할 목록 로드 (RoleGranted / RoleRevoked 이벤트) ────────────────────
  const loadRoleList = useCallback(async () => {
    if (!provider || !readContract) return;
    if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    setIsLoadingList(true);
    try {
      // 컨트랙트 배포 블록부터 전체 이력 조회
      // latest - 2000 으로 제한하면 배포 당시 constructor 이벤트가 누락됨
      const fromBlock = 0;

      const [grantedLogs, revokedLogs] = await Promise.all([
        provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock, toBlock: "latest",
          topics: [readContract.interface.getEvent("RoleGranted").topicHash] }),
        provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock, toBlock: "latest",
          topics: [readContract.interface.getEvent("RoleRevoked").topicHash] }),
      ]);

      // 등록된 역할 집합 계산 (grant - revoke)
      const active = new Map(); // key = `${address}-${roleKey}`

      const parseLog = (log) => {
        try {
          return readContract.interface.parseLog({ topics: log.topics, data: log.data });
        } catch {
          return null;
        }
      };

      // 블록 번호 기준 정렬 처리 (오래된 것부터)
      const allEvents = [
        ...grantedLogs.map((l) => ({ ...l, _type: "grant" })),
        ...revokedLogs.map((l) => ({ ...l, _type: "revoke" })),
      ].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

      for (const log of allEvents) {
        const parsed = parseLog(log);
        if (!parsed) continue;
        const roleKey = ROLE_HASH_TO_KEY[parsed.args.role];
        if (!roleKey) continue; // DEFAULT_ADMIN_ROLE 등 무시
        const addr = parsed.args.account?.toLowerCase();
        const mapKey = `${addr}-${roleKey}`;

        if (log._type === "grant") {
          active.set(mapKey, {
            address: parsed.args.account,
            roleKey,
            blockNumber: Number(log.blockNumber),
            txHash: log.transactionHash,
          });
        } else {
          active.delete(mapKey);
        }
      }

      setRoleList([...active.values()]);
      console.log(`[RoleManager] 역할 목록 로드: ${active.size}건 (블록 ${fromBlock}~${latest})`);
    } catch (err) {
      console.warn("[RoleManager] 역할 목록 로드 실패:", err.message);
    } finally {
      setIsLoadingList(false);
    }
  }, [provider, readContract]);

  useEffect(() => {
    loadRoleList();
  }, [loadRoleList]);

  // ── 주소 입력 핸들러 ──────────────────────────────────────────────────────
  function handleAddressChange(e) {
    const val = e.target.value;
    setAddress(val);
    if (val && !isValidAddress(val)) {
      setAddrError("0x로 시작하는 42자리 주소를 입력하세요");
    } else {
      setAddrError("");
    }
  }

  // ── 역할 등록 ─────────────────────────────────────────────────────────────
  async function handleGrant() {
    if (!isValidAddress(address)) {
      setAddrError("0x로 시작하는 42자리 주소를 입력하세요");
      return;
    }
    const role = ROLES.find((r) => r.key === selectedRole);
    if (!role) return;

    setIsSending(true);
    const txId = pushTx({ label: `${role.label} 역할 등록: ${shortenAddress(address)}` });
    try {
      const contract = await getSignedContract();
      const tx = await contract[role.grant](address);
      logTxSent(role.grant, { address, txHash: tx.hash });
      updateTx(txId, { status: "pending", txHash: tx.hash });

      const receipt = await tx.wait(1);
      logTxConfirmed({ txHash: tx.hash, blockNumber: receipt.blockNumber });

      // 온체인 hasRole() 로 실제 부여 여부 검증
      const roleCheckFnMap = {
        mill:        "hasMillRole",
        fabricator:  "hasFabricatorRole",
        integrator:  "hasIntegratorRole",
      };
      const confirmed = await readContract[roleCheckFnMap[selectedRole]](address);
      if (!confirmed) {
        updateTx(txId, { status: "rejected", errorMsg: "트랜잭션은 컨펌됐으나 역할이 부여되지 않았습니다. 컨트랙트 주소를 확인하세요." });
        console.error("[RoleManager] hasRole 검증 실패 — 역할 미부여:", address);
      } else {
        updateTx(txId, { status: "success", blockNumber: receipt.blockNumber });
        console.log(`[RoleManager] ${role.grant} 완료 (온체인 검증 ✅):`, address);
      }

      setAddress("");
      setAddrError("");
      await loadRoleList();
    } catch (err) {
      const msg = parseContractError(err);
      logContractError(role.grant, msg, { address });
      updateTx(txId, { status: "rejected", errorMsg: msg });
      console.error("[RoleManager] 역할 등록 실패:", err);
    } finally {
      setIsSending(false);
    }
  }

  // ── 역할 해제 확인 모달 ───────────────────────────────────────────────────
  async function handleRevoke() {
    if (!revokeTarget) return;
    const role = ROLES.find((r) => r.key === revokeTarget.roleKey);
    if (!role) return;

    setRevokeTarget(null);
    const txId = pushTx({ label: `${role.label} 역할 해제: ${shortenAddress(revokeTarget.address)}` });
    try {
      const contract = await getSignedContract();
      const tx = await contract[role.revoke](revokeTarget.address);
      logTxSent(role.revoke, { address: revokeTarget.address, txHash: tx.hash });
      updateTx(txId, { status: "pending", txHash: tx.hash });

      const receipt = await tx.wait(1);
      logTxConfirmed({ txHash: tx.hash, blockNumber: receipt.blockNumber });
      updateTx(txId, { status: "success", blockNumber: receipt.blockNumber });
      console.log(`[RoleManager] ${role.revoke} 완료:`, revokeTarget.address);

      await loadRoleList();
    } catch (err) {
      const msg = parseContractError(err);
      logContractError(role.revoke, msg, { address: revokeTarget.address });
      updateTx(txId, { status: "rejected", errorMsg: msg });
      console.error("[RoleManager] 역할 해제 실패:", err);
    }
  }

  const canGrant = isConnected && isValidAddress(address) && !isSending;
  const isDeployed = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <TabBtn active={activeTab === "register"} onClick={() => setActiveTab("register")}>역할 등록</TabBtn>
        <TabBtn active={activeTab === "list"} onClick={() => setActiveTab("list")}>
          역할 조회
          {roleList.length > 0 && (
            <span className="ml-1.5 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {roleList.length}
            </span>
          )}
        </TabBtn>
      </div>

      {/* ── 역할 등록 탭 ── */}
      {activeTab === "register" && (
        <div className="section-card max-w-lg space-y-5">
          {/* 지갑 주소 */}
          <div>
            <label className="label">
              지갑 주소 <span className="text-gray-400 font-mono text-xs">(Ethereum)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={handleAddressChange}
              placeholder="0x..."
              className={["input", addrError ? "border-red-400 focus:ring-red-300" : ""].join(" ")}
              disabled={isSending}
            />
            {addrError && (
              <p className="field-error mt-1">{addrError}</p>
            )}
          </div>

          {/* 역할 선택 */}
          <div>
            <label className="label">역할 선택</label>
            <div className="space-y-2.5">
              {ROLES.map((role) => (
                <label
                  key={role.key}
                  className="flex items-center gap-2.5 text-sm cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.key}
                    checked={selectedRole === role.key}
                    onChange={() => setSelectedRole(role.key)}
                    className="w-4 h-4 accent-blue-600"
                    disabled={isSending}
                  />
                  <span className="text-gray-800">{role.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleGrant}
            disabled={!canGrant}
            className="btn-blue w-full"
          >
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                트랜잭션 전송 중...
              </span>
            ) : (
              "역할 등록 — MetaMask ✍"
            )}
          </button>

          {!isConnected && (
            <p className="text-xs text-amber-600 text-center">
              MetaMask 연결 후 역할을 등록할 수 있습니다
            </p>
          )}
          {!isDeployed && (
            <p className="text-xs text-gray-400 text-center font-mono">
              VITE_CONTRACT_ADDRESS 미설정
            </p>
          )}
        </div>
      )}

      {/* ── 역할 조회 탭 ── */}
      {activeTab === "list" && (
        <div className="section-card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">등록된 역할 목록</p>
            <button
              onClick={loadRoleList}
              disabled={isLoadingList}
              className="btn-ghost text-xs py-1 px-2"
            >
              {isLoadingList ? "로딩..." : "↻ 새로고침"}
            </button>
          </div>

          {isLoadingList ? (
            <p className="text-sm text-gray-400 text-center py-6">이벤트 로드 중...</p>
          ) : !isDeployed ? (
            <p className="text-sm text-gray-400 text-center py-6 font-mono">
              컨트랙트 주소 미설정
            </p>
          ) : roleList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              최근 2,000 블록 내 등록된 역할 없음
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">주소</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">역할</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">블록</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {roleList.map((item) => {
                    const role = ROLES.find((r) => r.key === item.roleKey);
                    return (
                      <tr key={`${item.address}-${item.roleKey}`} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 font-mono text-xs text-gray-700">
                          <a
                            href={`${ETHERSCAN_BASE}/address/${item.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600"
                          >
                            {shortenAddress(item.address)}
                          </a>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`badge-role-${item.roleKey}`}>
                            {role?.label || item.roleKey}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                          <a
                            href={`${ETHERSCAN_BASE}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600"
                          >
                            #{item.blockNumber.toLocaleString()}
                          </a>
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => setRevokeTarget({ address: item.address, roleKey: item.roleKey })}
                            className="text-xs text-red-600 hover:text-red-800 hover:underline font-medium transition-colors"
                            disabled={!isConnected}
                          >
                            해제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 해제 확인 모달 ── */}
      {revokeTarget && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setRevokeTarget(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-bold text-gray-900 mb-2">역할을 해제하시겠습니까?</h3>
            <p className="text-sm text-gray-600 mb-1">
              주소: <span className="font-mono">{shortenAddress(revokeTarget.address)}</span>
            </p>
            <p className="text-sm text-gray-600 mb-5">
              역할: <span className="font-semibold">
                {ROLES.find((r) => r.key === revokeTarget.roleKey)?.label}
              </span>
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-5">
              해제 후 해당 주소는 이 역할의 기능을 사용할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRevokeTarget(null)}
                className="btn-ghost flex-1"
              >
                취소
              </button>
              <button
                onClick={handleRevoke}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                해제 — MetaMask ✍
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center",
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

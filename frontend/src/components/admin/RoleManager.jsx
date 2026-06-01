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
import { FormCard, Field, TxtInput, ActionFooter, ConfirmModal } from "../TxShared";
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
    <div className="tx-wrap wide">
      {/* 탭 */}
      <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:20 }}>
        <div></div>
        <div className="tabs">
          <button className={activeTab === "register" ? "is-on" : ""} onClick={() => setActiveTab("register")}>
            역할 등록
          </button>
          <button className={activeTab === "list" ? "is-on" : ""} onClick={() => setActiveTab("list")}>
            역할 조회
            {roleList.length > 0 && (
              <span style={{ marginLeft:6,background:"var(--status-active-bg)",color:"var(--status-active)",borderRadius:"999px",padding:"1px 7px",fontSize:10,fontFamily:"var(--font-mono)" }}>
                {roleList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── 역할 등록 탭 ── */}
      {activeTab === "register" && (
        <div className="form-stack">
          <FormCard title="역할 등록" en="Grant role" src="chain">
            <Field label="지갑 주소" en="address" req
              error={addrError}
              hint="중복 등록은 컨트랙트가 무시합니다 (idempotent).">
              <TxtInput value={address} onChange={handleAddressChange}
                placeholder="0x…" state={addrError ? "error" : address && isValidAddress(address) ? "ok" : null}
                disabled={isSending} />
            </Field>
            <Field label="역할 선택" en="role" req>
              <div className="role-radio-list">
                {ROLES.map((role) => (
                  <div key={role.key}
                    className={"role-radio" + (selectedRole === role.key ? " is-on" : "")}
                    onClick={() => !isSending && setSelectedRole(role.key)}>
                    <span className="radio"></span>
                    <span className="rr-txt">
                      <span className="nm">{role.label}</span>
                      <span className="ds">
                        {role.key === "mill" ? "강재 MTC 최초 발행 권한"
                          : role.key === "fabricator" ? "분할·조합 권한"
                          : "사용 등록 권한"}
                      </span>
                    </span>
                    <span className="rr-fn">{role.grant}()</span>
                  </div>
                ))}
              </div>
            </Field>
            <ActionFooter
              canSubmit={canGrant}
              gateNote="지갑 주소를 입력하세요"
              submitLabel="역할 등록"
              onReset={() => { setAddress(""); setAddrError(""); setSelectedRole("mill"); }}
              onSubmit={handleGrant}
              loading={isSending}
            />
          </FormCard>
        </div>
      )}

      {/* ── 역할 조회 탭 ── */}
      {activeTab === "list" && (
        <FormCard title="등록된 역할 목록" en="RoleGranted 이벤트 조회">
          <div style={{ display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:12 }}>
            <button className="btn-add" onClick={loadRoleList} disabled={isLoadingList}>
              {isLoadingList ? "로딩..." : "↻ 새로고침"}
            </button>
          </div>
          {isLoadingList ? (
            <p style={{ textAlign:"center",padding:"24px 0",fontSize:13,color:"var(--text-tertiary)" }}>이벤트 로드 중...</p>
          ) : !isDeployed ? (
            <p style={{ textAlign:"center",padding:"24px 0",fontSize:13,color:"var(--text-tertiary)",fontFamily:"var(--font-mono)" }}>컨트랙트 주소 미설정</p>
          ) : roleList.length === 0 ? (
            <p style={{ textAlign:"center",padding:"24px 0",fontSize:13,color:"var(--text-tertiary)" }}>등록된 역할 없음</p>
          ) : (
            <table className="role-table">
              <thead>
                <tr>
                  <th>주소</th>
                  <th>역할</th>
                  <th>블록</th>
                  <th className="right">액션</th>
                </tr>
              </thead>
              <tbody>
                {roleList.map((item) => {
                  const role = ROLES.find((r) => r.key === item.roleKey);
                  return (
                    <tr key={`${item.address}-${item.roleKey}`}>
                      <td className="addr">
                        <a href={`${ETHERSCAN_BASE}/address/${item.address}`}
                           target="_blank" rel="noopener noreferrer"
                           style={{ color:"var(--text-primary)",textDecoration:"none" }}>
                          {shortenAddress(item.address)}
                        </a>
                      </td>
                      <td>
                        <span className={`badge badge-role-${item.roleKey}`}>
                          {role?.key || item.roleKey}
                        </span>
                        <span style={{ color:"var(--text-secondary)",marginLeft:8,fontSize:12 }}>
                          {role?.label || item.roleKey}
                        </span>
                      </td>
                      <td className="date">
                        <a href={`${ETHERSCAN_BASE}/tx/${item.txHash}`}
                           target="_blank" rel="noopener noreferrer"
                           style={{ color:"var(--text-tertiary)",textDecoration:"none" }}>
                          #{item.blockNumber.toLocaleString()}
                        </a>
                      </td>
                      <td className="right">
                        <button
                          style={{ fontSize:12,color:"var(--tx-error)",background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0 }}
                          onClick={() => setRevokeTarget({ address: item.address, roleKey: item.roleKey })}
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
          )}
        </FormCard>
      )}

      {revokeTarget && (
        <ConfirmModal
          danger
          title="역할을 해제하시겠습니까?"
          body="해당 주소의 역할이 즉시 회수됩니다. 회수 후 이 주소는 해당 권한의 트랜잭션을 더 이상 수행할 수 없습니다."
          target={`${shortenAddress(revokeTarget.address)} · ${ROLES.find((r) => r.key === revokeTarget.roleKey)?.label}`}
          confirmLabel="역할 해제"
          onCancel={() => setRevokeTarget(null)}
          onConfirm={handleRevoke}
        />
      )}
    </div>
  );
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MtcRegistry
 * @notice 강재 자재 이력 시스템 (MTC on Blockchain) 메인 컨트랙트
 *
 * 구현 단계:
 *   Phase 2: 역할 관리 — grantMill/Fabricator/Integrator, revoke*, hasRole* view
 *   Phase 3: MTC 발행 + 소유권 이전
 *   Phase 4: 강재 분할 (splitSteel)
 *   Phase 5: 강재 조합 + 사용 매핑 + 조회 함수 ← 현재
 *
 * @dev OpenZeppelin AccessControl v5 기반
 *      RoleGranted / RoleRevoked 이벤트는 AccessControl에서 상속됨 — 재선언 금지
 *      onlyRole() 수정자는 AccessControlUnauthorizedAccount 에러를 발생시킴.
 *      issueMtc 등 비즈니스 함수에서는 수동 체크(if (!hasRole) revert NotXxx()) 사용.
 */
contract MtcRegistry is AccessControl {

    // ── 역할 상수 (§8.1) ──────────────────────────────────────────────────────
    // DEFAULT_ADMIN_ROLE = bytes32(0) — OpenZeppelin에서 정의됨
    bytes32 public constant MILL_ROLE       = keccak256("MILL_ROLE");
    bytes32 public constant FABRICATOR_ROLE = keccak256("FABRICATOR_ROLE");
    bytes32 public constant INTEGRATOR_ROLE = keccak256("INTEGRATOR_ROLE");

    // ── 이벤트 (§8.6) ─────────────────────────────────────────────────────────
    // RoleGranted / RoleRevoked → OpenZeppelin AccessControl에서 상속. 재선언 금지.
    //
    // string 파라미터는 indexed 불가 (ethers.js v6에서 null 반환 버그)
    event SteelMinted(
        string  steelId,
        address indexed mill,
        uint256 weight,
        string  ipfsCid,
        bytes32 indexed pdfHash,
        uint256 timestamp
    );
    event SteelOwnershipTransferred(
        string  steelId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );
    event SteelSplit(
        string   parentId,
        string[] childIds,        // 배열 — non-indexed
        uint256  parentWeight,
        uint256[] childWeights,
        address  indexed operator,
        uint256  timestamp
    );
    event SteelCombined(
        string[]  parentIds,        // 배열 — non-indexed
        string    childId,
        uint256   totalParentWeight,
        uint256   childWeight,
        address   indexed operator,
        uint256   timestamp
    );
    event SteelUsed(
        string  steelId,
        string  productId,          // 서버(KV)에서 description 관리
        address indexed integrator,
        uint256 timestamp
    );

    // ── 커스텀 에러 (§8.7) ────────────────────────────────────────────────────
    error SteelExists(string steelId);
    error SteelNotFound(string steelId);
    error SteelNotActive(string steelId, SteelStatus current);
    error NotOwner(string steelId, address caller, address owner);
    error InvalidRecipient(address recipient);
    error InvalidWeight();
    error InvalidPdfHash();
    error InvalidCid();
    error NotMill();
    error NotFabricator();
    error NotIntegrator();
    error WeightExceedsParent(uint256 childTotal, uint256 parentWeight);
    error WeightLossExceeded(uint256 childTotal, uint256 minRequired);
    error InvalidChildCount(uint256 count);
    error NeedMultipleParents();
    error InvalidParentCount(uint256 count);
    error InvalidProductId();

    // ── 데이터 구조 (§8.2, §8.3) ─────────────────────────────────────────────
    enum SteelStatus { ACTIVE, SPLIT, COMBINED, USED }

    struct Steel {
        string   steelId;
        uint256  weight;      // 그램(g) 단위
        string   ipfsCid;
        bytes32  pdfHash;
        SteelStatus status;
        address  mill;        // 최초 발행 Mill
        address  owner;       // 현재 소유자
        uint256  createdAt;
        string[] parentIds;   // Phase 4~5에서 사용
        string[] childIds;    // Phase 4에서 사용
    }

    mapping(string => Steel)  private steels;
    mapping(string => bool)   private steelExists;
    mapping(string => string) private productMap; // productId → steelId

    // ── 생성자 ────────────────────────────────────────────────────────────────

    constructor() {
        // 배포자에게 DEFAULT_ADMIN_ROLE 부여
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // §4.2: Admin은 모든 역할을 자동 보유 (졸업과제 데모 전용)
        // — 단일 지갑으로 모든 역할 시연 가능하게 함
        _grantRole(MILL_ROLE, msg.sender);
        _grantRole(FABRICATOR_ROLE, msg.sender);
        _grantRole(INTEGRATOR_ROLE, msg.sender);
    }

    // ── 역할 등록 함수 (§8.5.1) ───────────────────────────────────────────────

    /// @notice 지갑 주소에 Mill(제강사) 역할을 부여한다
    /// @param account 역할을 부여할 지갑 주소
    function grantMill(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MILL_ROLE, account);
    }

    /// @notice 지갑 주소에 Fabricator(가공사) 역할을 부여한다
    function grantFabricator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(FABRICATOR_ROLE, account);
    }

    /// @notice 지갑 주소에 Integrator(통합사) 역할을 부여한다
    function grantIntegrator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(INTEGRATOR_ROLE, account);
    }

    // ── 역할 해제 함수 (§8.5.1) ───────────────────────────────────────────────

    /// @notice Mill(제강사) 역할을 해제한다
    function revokeMill(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MILL_ROLE, account);
    }

    /// @notice Fabricator(가공사) 역할을 해제한다
    function revokeFabricator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(FABRICATOR_ROLE, account);
    }

    /// @notice Integrator(통합사) 역할을 해제한다
    function revokeIntegrator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(INTEGRATOR_ROLE, account);
    }

    // ── 역할 조회 함수 (§8.5.7) ───────────────────────────────────────────────

    /// @notice 지갑 주소의 Mill 역할 보유 여부 조회
    function hasMillRole(address account) external view returns (bool) {
        return hasRole(MILL_ROLE, account);
    }

    /// @notice 지갑 주소의 Fabricator 역할 보유 여부 조회
    function hasFabricatorRole(address account) external view returns (bool) {
        return hasRole(FABRICATOR_ROLE, account);
    }

    /// @notice 지갑 주소의 Integrator 역할 보유 여부 조회
    function hasIntegratorRole(address account) external view returns (bool) {
        return hasRole(INTEGRATOR_ROLE, account);
    }

    // ── MTC 발행 (§8.5.2) ────────────────────────────────────────────────────

    /**
     * @notice 강재 MTC를 발행한다 (Mill 전용)
     * @param steelId  강재 고유 ID (예: "POSCO-2024-0001")
     * @param weight   무게 (그램 단위, 0 불가)
     * @param ipfsCid  IPFS에 업로드된 PDF의 CID
     * @param pdfHash  PDF 파일의 SHA-256 해시 (bytes32, 0x00 불가)
     */
    function issueMtc(
        string calldata steelId,
        uint256 weight,
        string calldata ipfsCid,
        bytes32 pdfHash
    ) external {
        if (!hasRole(MILL_ROLE, msg.sender))       revert NotMill();
        if (steelExists[steelId])                  revert SteelExists(steelId);
        if (weight == 0)                           revert InvalidWeight();
        if (pdfHash == bytes32(0))                 revert InvalidPdfHash();
        if (bytes(ipfsCid).length == 0)            revert InvalidCid();

        Steel storage s = steels[steelId];
        s.steelId   = steelId;
        s.weight    = weight;
        s.ipfsCid   = ipfsCid;
        s.pdfHash   = pdfHash;
        s.status    = SteelStatus.ACTIVE;
        s.mill      = msg.sender;
        s.owner     = msg.sender;
        s.createdAt = block.timestamp;
        // parentIds / childIds는 빈 배열로 초기화됨 (dynamic array default)

        steelExists[steelId] = true;

        emit SteelMinted(steelId, msg.sender, weight, ipfsCid, pdfHash, block.timestamp);
    }

    // ── 소유권 이전 (§8.5.3) ──────────────────────────────────────────────────

    /**
     * @notice 강재 소유권을 이전한다
     * @param steelId  대상 강재 ID
     * @param to       수신자 주소 (Fabricator 또는 Integrator 역할 필수)
     */
    function transferOwnership(string calldata steelId, address to) external {
        if (!steelExists[steelId])                         revert SteelNotFound(steelId);
        Steel storage s = steels[steelId];
        if (s.owner != msg.sender)                         revert NotOwner(steelId, msg.sender, s.owner);
        if (s.status != SteelStatus.ACTIVE)                revert SteelNotActive(steelId, s.status);
        // 수신자는 Fabricator, Integrator, 또는 Admin 중 하나여야 함
        if (
            !hasRole(FABRICATOR_ROLE,    to) &&
            !hasRole(INTEGRATOR_ROLE,    to) &&
            !hasRole(DEFAULT_ADMIN_ROLE, to)
        ) revert InvalidRecipient(to);

        address prev = s.owner;
        s.owner = to;

        emit SteelOwnershipTransferred(steelId, prev, to, block.timestamp);
    }

    // ── 강재 조회 (§8.5.7) ────────────────────────────────────────────────────

    /**
     * @notice 강재 정보를 반환한다
     * @param steelId  조회할 강재 ID
     */
    function getSteel(string calldata steelId) external view returns (Steel memory) {
        if (!steelExists[steelId]) revert SteelNotFound(steelId);
        return steels[steelId];
    }

    // ── 강재 분할 (§8.5.4) ───────────────────────────────────────────────────

    /**
     * @notice 강재를 N개로 분할한다 (Fabricator 전용)
     * @param parentId     분할할 부모 강재 ID
     * @param childWeights 각 자식의 무게 배열 (g 단위, 2~10개)
     * @return childIds    생성된 자식 강재 ID 배열 ({parentId}_{순번} 형식)
     */
    function splitSteel(
        string calldata  parentId,
        uint256[] calldata childWeights
    ) external returns (string[] memory childIds) {
        if (!hasRole(FABRICATOR_ROLE, msg.sender))    revert NotFabricator();
        if (!steelExists[parentId])                   revert SteelNotFound(parentId);

        Steel storage parent = steels[parentId];
        if (parent.owner != msg.sender)               revert NotOwner(parentId, msg.sender, parent.owner);
        if (parent.status != SteelStatus.ACTIVE)      revert SteelNotActive(parentId, parent.status);
        if (childWeights.length < 2 || childWeights.length > 10)
            revert InvalidChildCount(childWeights.length);

        // 각 자식 무게 > 0 확인 + 합산
        uint256 totalChildWeight = 0;
        for (uint256 i = 0; i < childWeights.length; i++) {
            if (childWeights[i] == 0) revert InvalidWeight();
            totalChildWeight += childWeights[i];
        }

        // 무게 보존 검증 (오버플로우 방지: 곱셈 비교 형식 사용)
        uint256 parentWeight = parent.weight;
        if (totalChildWeight > parentWeight)
            revert WeightExceedsParent(totalChildWeight, parentWeight);
        // 손실률 ≤ 10% → totalChildWeight * 100 ≥ parentWeight * 90
        if (totalChildWeight * 100 < parentWeight * 90)
            revert WeightLossExceeded(totalChildWeight, parentWeight * 90 / 100);

        // 자식 ID 사전 생성 + 중복 체크
        childIds = new string[](childWeights.length);
        for (uint256 i = 0; i < childWeights.length; i++) {
            string memory childId = string.concat(parentId, "_", Strings.toString(i + 1));
            if (steelExists[childId]) revert SteelExists(childId);
            childIds[i] = childId;
        }

        // 부모 상태 SPLIT 전환 후 자식 강재 생성
        parent.status = SteelStatus.SPLIT;

        for (uint256 i = 0; i < childWeights.length; i++) {
            Steel storage child = steels[childIds[i]];
            child.steelId   = childIds[i];
            child.weight    = childWeights[i];
            child.ipfsCid   = parent.ipfsCid;   // 부모 PDF CID 상속
            child.pdfHash   = parent.pdfHash;   // 부모 PDF 해시 상속
            child.status    = SteelStatus.ACTIVE;
            child.mill      = parent.mill;       // 원래 제강사 정보 유지
            child.owner     = msg.sender;
            child.createdAt = block.timestamp;
            child.parentIds.push(parentId);
            steelExists[childIds[i]] = true;

            parent.childIds.push(childIds[i]);  // 부모 트리 연결
        }

        emit SteelSplit(parentId, childIds, parentWeight, childWeights, msg.sender, block.timestamp);
    }

    // ── 강재 조합 (§8.5.5) ───────────────────────────────────────────────────

    /**
     * @notice N개 강재를 1개로 조합한다 (Fabricator 전용, N: 2~10)
     * @param parentIds   부모 강재 ID 배열 (2~10개, 각 ACTIVE + 본인 소유)
     * @param childId     새로 생성할 강재 ID
     * @param childWeight 결과물 무게 (g, totalParentWeight × 85% 이상)
     * @param ipfsCid     결과물 MTC PDF IPFS CID
     * @param pdfHash     결과물 MTC PDF SHA-256 해시
     */
    function combineSteel(
        string[] calldata parentIds,
        string calldata   childId,
        uint256           childWeight,
        string calldata   ipfsCid,
        bytes32           pdfHash
    ) external {
        if (!hasRole(FABRICATOR_ROLE, msg.sender)) revert NotFabricator();
        if (parentIds.length < 2)                  revert NeedMultipleParents();
        if (parentIds.length > 10)                 revert InvalidParentCount(parentIds.length);
        if (steelExists[childId])                  revert SteelExists(childId);
        if (childWeight == 0)                      revert InvalidWeight();
        if (pdfHash == bytes32(0))                 revert InvalidPdfHash();
        if (bytes(ipfsCid).length == 0)            revert InvalidCid();

        // 부모 일괄 검증 + 무게 합산
        uint256 totalParentWeight = 0;
        for (uint256 i = 0; i < parentIds.length; i++) {
            if (!steelExists[parentIds[i]])
                revert SteelNotFound(parentIds[i]);
            Steel storage p = steels[parentIds[i]];
            if (p.owner != msg.sender)
                revert NotOwner(parentIds[i], msg.sender, p.owner);
            if (p.status != SteelStatus.ACTIVE)
                revert SteelNotActive(parentIds[i], p.status);
            totalParentWeight += p.weight;
        }

        // 무게 보존 검증 (허용 손실 ≤ 15%)
        if (childWeight > totalParentWeight)
            revert WeightExceedsParent(childWeight, totalParentWeight);
        if (childWeight * 100 < totalParentWeight * 85)
            revert WeightLossExceeded(childWeight, totalParentWeight * 85 / 100);

        // 부모 상태 COMBINED 전환 + 자식 ID 연결
        for (uint256 i = 0; i < parentIds.length; i++) {
            steels[parentIds[i]].status = SteelStatus.COMBINED;
            steels[parentIds[i]].childIds.push(childId);
        }

        // 자식 강재 생성 (조합재: mill은 address(0) — 단일 원산지 없음)
        Steel storage child = steels[childId];
        child.steelId   = childId;
        child.weight    = childWeight;
        child.ipfsCid   = ipfsCid;
        child.pdfHash   = pdfHash;
        child.status    = SteelStatus.ACTIVE;
        child.mill      = address(0);
        child.owner     = msg.sender;
        child.createdAt = block.timestamp;
        for (uint256 i = 0; i < parentIds.length; i++) {
            child.parentIds.push(parentIds[i]);
        }
        steelExists[childId] = true;

        emit SteelCombined(parentIds, childId, totalParentWeight, childWeight, msg.sender, block.timestamp);
    }

    // ── 사용 매핑 (§8.5.6) ───────────────────────────────────────────────────

    /**
     * @notice 강재를 부품에 사용 등록한다 (Integrator 전용, 불가역)
     * @param steelId    사용할 강재 ID (ACTIVE + 본인 소유)
     * @param productId  연결할 부품 ID (빈 문자열 불가)
     */
    function markAsUsed(
        string calldata steelId,
        string calldata productId
    ) external {
        if (!hasRole(INTEGRATOR_ROLE, msg.sender)) revert NotIntegrator();
        if (!steelExists[steelId])                 revert SteelNotFound(steelId);
        Steel storage s = steels[steelId];
        if (s.owner != msg.sender)                 revert NotOwner(steelId, msg.sender, s.owner);
        if (s.status != SteelStatus.ACTIVE)        revert SteelNotActive(steelId, s.status);
        if (bytes(productId).length == 0)          revert InvalidProductId();

        s.status = SteelStatus.USED;
        productMap[productId] = steelId;

        emit SteelUsed(steelId, productId, msg.sender, block.timestamp);
    }

    // ── 조회 함수 (§8.5.7) ────────────────────────────────────────────────────

    /// @notice 부모 강재 ID 목록 조회
    function getParents(string calldata steelId) external view returns (string[] memory) {
        if (!steelExists[steelId]) revert SteelNotFound(steelId);
        return steels[steelId].parentIds;
    }

    /// @notice 자식 강재 ID 목록 조회
    function getChildren(string calldata steelId) external view returns (string[] memory) {
        if (!steelExists[steelId]) revert SteelNotFound(steelId);
        return steels[steelId].childIds;
    }

    /**
     * @notice 부품 ID로 강재 ID를 역조회한다
     * @return 매핑된 steelId, 미등록이면 빈 문자열 반환 (프론트에서 처리)
     */
    function getSteelByProduct(string calldata productId) external view returns (string memory) {
        return productMap[productId];
    }
}

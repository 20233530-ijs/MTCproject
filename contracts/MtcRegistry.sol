// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MtcRegistry
 * @notice 강재 자재 이력 시스템 (MTC on Blockchain) 메인 컨트랙트
 *
 * 구현 단계:
 *   Phase 2: 역할 관리 — grantMill/Fabricator/Integrator, revoke*, hasRole* view ← 현재
 *   Phase 3: MTC 발행 + 소유권 이전
 *   Phase 4: 강재 분할 (splitSteel)
 *   Phase 5: 강재 조합 + 사용 매핑 + 조회 함수
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
    // RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
    // RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
    // → OpenZeppelin AccessControl에서 상속됨. 재선언 시 컴파일 에러.
    //
    // Phase 3에서 추가될 이벤트:
    //   event SteelMinted(string steelId, address indexed mill, uint256 weight,
    //                     string ipfsCid, bytes32 indexed pdfHash, uint256 timestamp);
    //   event SteelOwnershipTransferred(string steelId, address indexed from,
    //                                   address indexed to, uint256 timestamp);
    // Phase 4: event SteelSplit(...)
    // Phase 5: event SteelCombined(...), event SteelUsed(...)

    // ── 커스텀 에러 (§8.7) ────────────────────────────────────────────────────
    // Phase 3에서 추가될 에러:
    //   error SteelExists(string steelId);
    //   error SteelNotFound(string steelId);
    //   error SteelNotActive(string steelId, SteelStatus current);
    //   error NotOwner(string steelId, address caller, address owner);
    //   error InvalidRecipient(address recipient);
    //   error WeightExceedsParent(uint256 childTotal, uint256 parentWeight);
    //   error WeightLossExceeded(uint256 childTotal, uint256 minRequired);
    //   error InvalidWeight();
    //   error InvalidPdfHash();
    //   error InvalidCid();
    //   error NotMill();
    //   error NotFabricator();
    //   error NotIntegrator();
    // Phase 4: error InvalidChildCount(uint256 count);
    // Phase 5: error NeedMultipleParents(); error InvalidParentCount(uint256 count);
    //          error InvalidProductId();

    // ── Phase 3에서 추가될 데이터 구조 ──────────────────────────────────────
    // enum SteelStatus { ACTIVE, SPLIT, COMBINED, USED }
    // struct Steel { ... }
    // mapping(string => Steel) private steels;
    // mapping(string => bool)  private steelExists;
    // mapping(string => string) private productMap;

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

    // Phase 3~5 함수들은 아래에 추가 예정:
    //   issueMtc / transferOwnership / splitSteel / combineSteel / markAsUsed
    //   getSteel / getParents / getChildren / getSteelByProduct
}

# 강재 자재 이력 시스템 (MTC on Blockchain)
## 통합 PRD + SRS 문서

**문서 버전**: v1.2  
**작성일**: 2026-05-26  
**최종 수정**: 2026-05-29 (§20 구현 계획 추가, 전체 일관성 보완, 기술 검증 이슈 수정)  
**프로젝트 유형**: 학부 졸업과제  
**블록체인 네트워크**: Ethereum Sepolia Testnet  
**배포 환경**: Cloudflare Pages  

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [문제 정의 및 배경](#2-문제-정의-및-배경)
3. [목표 및 성공 기준](#3-목표-및-성공-기준)
4. [사용자 및 이해관계자](#4-사용자-및-이해관계자)
5. [기능 요구사항 (PRD)](#5-기능-요구사항-prd)
6. [비기능 요구사항 (PRD)](#6-비기능-요구사항-prd)
7. [시스템 아키텍처 (SRS)](#7-시스템-아키텍처-srs)
8. [스마트 컨트랙트 명세 (SRS)](#8-스마트-컨트랙트-명세-srs)
9. [데이터 모델 (SRS)](#9-데이터-모델-srs)
10. [프론트엔드 명세 (SRS)](#10-프론트엔드-명세-srs)
11. [IPFS 연동 명세 (SRS)](#11-ipfs-연동-명세-srs)
11-B. [백엔드 API 명세 (Cloudflare Workers + KV)](#11-b-백엔드-api-명세-cloudflare-workers--kv)
12. [데모 시연 시나리오 (SRS)](#12-데모-시연-시나리오-srs)
13. [로깅 명세 (SRS)](#13-로깅-명세-srs)
14. [보안 요구사항 (SRS)](#14-보안-요구사항-srs)
15. [테스트 계획 (SRS)](#15-테스트-계획-srs)
16. [배포 명세 (SRS)](#16-배포-명세-srs)
17. [일정 계획](#17-일정-계획)
18. [용어 정의](#18-용어-정의)
19. [화면 설계서](#19-화면-설계서)
20. [구현 계획](#20-구현-계획)

---

## 1. 프로젝트 개요

### 1.1 프로젝트명
**강재 자재 이력 시스템 (MTC on Blockchain)**  
영문명: Steel Material Traceability System using Blockchain

### 1.2 한 줄 요약
> 강재(鋼材)의 자재증명서(Mill Test Certificate, MTC)를 이더리움 블록체인에 등록하여, 위조 불가능한 이력 추적 및 진본성 검증 시스템을 구현한다.

### 1.3 핵심 가치 제안
| 기존 방식 | 블록체인 방식 |
|---|---|
| PDF → 카카오톡/이메일 전달 | PDF 해시 → 블록체인 온체인 기록 |
| 위조 가능 (포토샵 등) | 해시 불일치 즉시 감지 |
| 분실 시 수일~수주 재발급 | IPFS CID로 영구 접근 |
| 다단계 유통 중 진본 확인 불가 | 스마트 컨트랙트로 자동 검증 |
| 사고 시 원인 추적 불가 | 부모-자식 트리로 완전 추적 |

---

## 2. 문제 정의 및 배경

### 2.1 산업 배경
강재(鋼材)는 건축물, 선박, 자동화 설비 등 산업 인프라의 핵심 소재다. 강재를 납품할 때는 반드시 **자재증명서(Mill Test Certificate, MTC; 한국 현장 용어: "밀시트")**가 수반되어야 한다. 밀시트는 해당 강재의 화학 성분과 기계적 성질(항복강도, 인장강도, 연신율 등)을 제강사가 공식 보증하는 문서다.

### 2.2 실제 발생 사기 사례
- **코베스틸(Covesteel) 데이터 조작 사건**: MTC의 기계적 수치를 위조하여 납품
- **차이나 스틸(China Steel) 위조 사례**: PDF 자체를 위조하여 불량 강재 유통
- **기타 글로벌 대형 스캔들**: 브라질, 유럽, 중동에서 유사 사례 다수 보고
- **국내 현장**: 라벨(Heat Number)만 동일한 저급 강재로 교체하는 이른바 "강재 바꿔치기"

### 2.3 현행 프로세스의 문제점

```
제강사 → [PDF 이메일/카카오톡] → 가공사 → [PDF 전달] → 통합사 → 최종 사용자
         ▲ 위조 가능                ▲ 분실 가능               ▲ 검증 불가
```

1. **위조 용이성**: PDF는 이미지 편집 도구로 수치 변조 가능
2. **분실 빈번**: 수신 확인 없이 이메일 첨부 전달 → 재요청에 수일~수주 소요
3. **진본성 검증 불가**: 다단계 유통 경로에서 원본 대비 위변조 여부 확인 수단 없음
4. **사고 역추적 불가**: 강구조물 사고 발생 시 해당 강재의 원본 MTC 추적 사실상 불가
5. **가공 이력 단절**: 분할/조합 과정에서 원재료와 최종 제품 간 연결고리 소멸

### 2.4 블록체인이 해결책인 이유

단순 데이터베이스(DB)로도 중앙화된 이력 관리는 가능하다. 그러나 다음 이유로 블록체인이 본질적으로 적합하다:

- **신뢰 기관 부재**: 제강사·가공사·통합사 간 이해관계가 충돌하므로 어느 한 기업의 서버를 신뢰할 수 없다
- **불변성(Immutability)**: 한 번 기록된 MTC 해시는 변경 불가 — 위조 입증 자동화
- **투명성**: 모든 이해관계자가 동일한 온체인 상태를 조회 가능
- **자동화된 규칙 집행**: 무게 보존 법칙 등 비즈니스 규칙을 스마트 컨트랙트가 자동 강제

---

## 3. 목표 및 성공 기준

### 3.1 프로젝트 목표

| 구분 | 목표 |
|---|---|
| 기술 목표 | Sepolia 테스트넷에 스마트 컨트랙트 배포 및 실제 동작 |
| 기능 목표 | 10개 데모 시나리오 모두 성공적으로 시연 |
| UX 목표 | MetaMask 연동 웹 UI에서 모든 기능 조작 가능 |
| 보안 목표 | 무게 초과, 권한 없는 발행, 재분할 시도 등 3종 사기 시도를 컨트랙트가 거부 |
| 학술 목표 | 블록체인 기술이 단순 DB 대체가 아닌 본질적 역할로 활용됨을 증명 |

### 3.2 성공 기준 (Definition of Done)

- [ ] 스마트 컨트랙트가 Sepolia에 배포되어 etherscan에서 확인 가능
- [ ] 웹 UI가 Cloudflare Pages에 배포되어 퍼블릭 URL 접근 가능
- [ ] MetaMask 연동 후 4개 컨트랙트 역할(Admin/Mill/Fabricator/Integrator) 전환 및 Auditor 읽기 전용 모드 포함 총 5개 모드 시연 가능
- [ ] IPFS PDF 업로드 → 해시 검증 시연 가능
- [ ] 10개 데모 시나리오 전부 통과 (사기 시도 3개는 거부 확인)
- [ ] 이벤트 로그가 온체인 트랜잭션에 기록되어 조회 가능

---

## 4. 사용자 및 이해관계자

### 4.1 사용자 역할 정의

#### Role 1: 제강사 (Mill)
- **대표 사례**: POSCO, HYUNDAI Steel
- **주요 책임**: MTC 원본 발행
- **권한 범위**:
  - MTC 발행 (강재 ID, 무게, 화학성분, 기계적성질, PDF 해시, IPFS CID 등록)
  - 소유권 이전 (자신이 보유한 강재 → 가공사)
- **제약**: 관리자가 지갑 주소를 사전 등록한 경우에만 발행 가능

#### Role 2: 가공사 (Fabricator)
- **대표 사례**: 철강 가공 전문 중소기업
- **주요 책임**: 원자재 강재를 분할 또는 조합하여 반제품 생성
- **권한 범위**:
  - 강재 분할 (1 → N, 최대 10조각)
  - 강재 조합 (N → 1)
  - 소유권 이전 (가공된 강재 → 통합사 또는 타 가공사)
- **제약**: 무게 보존 법칙 준수 (컨트랙트가 자동 검사)

#### Role 3: 설비 통합사 (Integrator)
- **대표 사례**: 자동화 설비 제조사
- **주요 책임**: 강재를 실제 제품/부품에 사용 등록
- **권한 범위**:
  - 사용 매핑 (강재 ID → 부품 ID 연결)
  - 제품 이력 조회
- **제약**: 자신이 보유한 강재만 사용 등록 가능

#### Role 4: 조회자 (Auditor / End User)
- **대표 사례**: 발주처, 안전 감리원, 보험사, 일반 시민
- **주요 책임**: 강재 이력 검증
- **권한 범위**:
  - 강재 ID 또는 부품 ID로 전체 이력 트리 조회
  - PDF 다운로드 및 해시 자동 검증
- **제약**: 읽기 전용 (트랜잭션 발생 없음)

### 4.2 관리자 (Admin) — 졸업과제 데모 전용

> **중요**: 이 역할은 실제 시스템에는 존재하지 않으나, 졸업과제 시연을 위해 설계된 슈퍼유저다.

- **목적**: 시연자가 1명의 지갑으로 모든 역할을 수행 가능하게 함
- **권한 범위**: 제강사 + 가공사 + 통합사 + 조회자 전체 권한
- **추가 권한**:
  - 지갑 주소 역할 등록/해제
  - 특정 강재의 상태 강제 조회
- **컨트랙트 구현**: `DEFAULT_ADMIN_ROLE` (OpenZeppelin AccessControl 기반)

### 4.3 이해관계자 (비사용자)

| 이해관계자 | 관심사 |
|---|---|
| 졸업과제 지도교수 | 블록체인 기술의 본질적 활용 여부, 코드 완성도 |
| 심사위원 | 실제 동작 여부, 데모 완성도 |
| 산업 현장 (간접) | 실용성, 확장 가능성 |

---

## 5. 기능 요구사항 (PRD)

### 5.1 기능 목록 요약

| ID | 기능명 | 주체 | 우선순위 |
|---|---|---|---|
| F-01 | 역할 등록 관리 | Admin | 최고 |
| F-02 | MTC 발행 | Mill | 최고 |
| F-03 | 소유권 이전 | Mill / Fabricator | 최고 |
| F-04 | 강재 분할 (1:N) | Fabricator | 최고 |
| F-05 | 강재 조합 (N:1) | Fabricator | 최고 |
| F-06 | 사용 매핑 | Integrator | 최고 |
| F-07 | 이력 조회 | Auditor (누구나) | 최고 |
| F-08 | PDF 업로드 및 해시 검증 | Mill / Auditor | 높음 |
| F-09 | 역할 전환 UI | Admin | 높음 (데모용) |
| F-10 | 사기 시도 거부 | 컨트랙트 자동 | 최고 |

---

### 5.2 F-01: 역할 등록 관리

**Actor**: Admin  
**목적**: 제강사/가공사/통합사 지갑 주소를 시스템에 등록하여 발행 권한을 부여한다

**기능 상세**:
- Admin은 이더리움 지갑 주소를 입력하여 역할(Mill / Fabricator / Integrator)을 부여
- 역할 해제(Revoke)도 가능
- 한 지갑 주소에 복수 역할 부여 가능 (Admin 전용 기능)
- Admin 자신에게는 모든 역할이 자동 부여됨

**입력**: 지갑 주소 (0x...), 역할 선택 (Mill / Fabricator / Integrator)  
**출력**: 트랜잭션 해시, 이벤트 로그 `RoleGranted(role, account, sender)`

**비즈니스 규칙**:
- Admin 외 누구도 역할을 등록할 수 없음
- 이미 등록된 주소에 동일 역할 재등록 시 무시 (idempotent)

---

### 5.3 F-02: MTC 발행

**Actor**: Mill (제강사)  
**목적**: 새로운 강재에 대한 MTC를 블록체인에 최초 등록한다

**기능 상세**:
- 강재 고유 ID (Heat Number 기반) 입력
- 강재 무게 (kg, 소수점 1자리)
- 화학 성분 등록: C, Si, Mn, P, S (질량분율 %, 소수점 3자리)
- 기계적 성질 등록: 항복강도(MPa), 인장강도(MPa), 연신율(%)
- PDF 파일 업로드 → IPFS에 업로드 → CID 및 SHA-256 해시를 온체인 저장
- 강재 등급(Grade) 입력 (예: SS400, SM490)

**입력 필드**:

| 필드명 | 저장 위치 | 타입 | 설명 | 예시 |
|---|---|---|---|---|
| steelId | 블록체인 | string | Heat Number (고유값) | H_001 |
| weight | 블록체인 | uint256 | 무게 (g 단위 정수 저장, UI에서 kg 표시) | 1000000 (= 1000 kg) |
| ipfsCid | 블록체인 | string | IPFS CID | Qm... |
| pdfHash | 블록체인 | bytes32 | PDF SHA-256 해시 (브라우저 자동 계산) | 0x... |
| grade | 서버(KV) | string | 강재 등급 | SS400 |
| chemC | 서버(KV) | number | 탄소 함량 (%) | 0.170 |
| chemSi | 서버(KV) | number | 규소 함량 (%) | 0.250 |
| chemMn | 서버(KV) | number | 망간 함량 (%) | 1.200 |
| chemP | 서버(KV) | number | 인 함량 (%) | 0.035 |
| chemS | 서버(KV) | number | 황 함량 (%) | 0.030 |
| yieldStrength | 서버(KV) | number | 항복강도 (MPa) | 245 |
| tensileStrength | 서버(KV) | number | 인장강도 (MPa) | 400 |
| elongation | 서버(KV) | number | 연신율 (%) | 21 |

**출력**: `SteelMinted(steelId, mill, weight, ipfsCid, pdfHash, timestamp)` 이벤트

**비즈니스 규칙**:
- Mill 역할이 없는 지갑 → 거부 (`revert: NOT_MILL`)
- 이미 존재하는 steelId → 거부 (`revert: STEEL_EXISTS`)
- weight == 0 → 거부
- pdfHash가 bytes32(0) → 거부 (PDF 없는 발행 불허)

---

### 5.4 F-03: 소유권 이전

**Actor**: Mill, Fabricator  
**목적**: 강재의 현재 소유자가 다른 등록된 주소로 소유권을 이전한다

**기능 상세**:
- 현재 보유 강재 목록에서 선택
- 이전 대상 주소 입력
- 이전 후 이전자는 해당 강재에 대한 모든 권한 상실

**비즈니스 규칙**:
- 현재 소유자만 이전 가능
- 이미 분할/조합/사용 완료된 강재는 이전 불가 (상태: ACTIVE만 이전 가능)
- 이전 대상은 시스템에 등록된 주소여야 함 (Fabricator 또는 Integrator)

**출력**: `SteelOwnershipTransferred(steelId, from, to, timestamp)` 이벤트

---

### 5.5 F-04: 강재 분할 (1:N)

**Actor**: Fabricator (가공사)  
**목적**: 하나의 강재를 여러 조각으로 분할하여 자식 강재 ID를 생성한다

**기능 상세**:
- 부모 강재 1개 선택
- 자식 강재 N개 무게 배열 입력 (N ≤ 10)
- 컨트랙트가 무게 보존 검사 → 통과 시 자식 강재 생성 및 부모 상태 SPLIT으로 변경
- 자식 강재 ID는 컨트랙트 내부에서 자동 생성: `{부모ID}_{순번}` 형식

**무게 보존 규칙**:
```
sum(자식 무게) ≥ 부모 무게 × 0.90   (최대 10% 손실 허용)
sum(자식 무게) ≤ 부모 무게           (부풀리기 절대 불가)
```

**비즈니스 규칙**:
- Fabricator 역할 없는 지갑 → 거부
- 부모 강재 현재 소유자가 호출자가 아닌 경우 → 거부
- 부모 강재 상태가 ACTIVE가 아닌 경우 → 거부 (이미 분할/사용된 강재)
- 자식 개수 > 10 → 거부
- 자식 무게 중 0인 항목 → 거부

**출력**: `SteelSplit(parentId, childIds[], parentWeight, childWeights[], operator, timestamp)` 이벤트

---

### 5.6 F-05: 강재 조합 (N:1)

**Actor**: Fabricator (가공사)  
**목적**: 복수의 강재를 하나로 조합하여 새로운 강재 ID를 생성한다 (예: 파이프 용접)

**기능 상세**:
- 부모 강재 N개 선택 (자신이 보유한 강재만 선택 가능)
- 자식(결과물) 강재 무게 입력
- 자식 강재 ID는 수동 입력 또는 자동 생성
- 모든 부모 강재는 전량 사용 처리 (상태: COMBINED)

**무게 보존 규칙**:
```
sum(자식 무게) ≥ sum(부모 무게) × 0.85  (최대 15% 손실 허용, 용접 열손실 등 감안)
sum(자식 무게) ≤ sum(부모 무게)           (부풀리기 절대 불가)
```

**비즈니스 규칙**:
- Fabricator 역할 없는 지갑 → 거부
- 부모 강재 중 호출자가 소유하지 않은 것 → 거부
- 부모 강재 중 ACTIVE 상태가 아닌 것 → 거부
- 부모 강재가 1개뿐인 조합 시도 → 거부 (1:1은 소유권 이전으로 처리)

**출력**: `SteelCombined(parentIds[], childId, totalParentWeight, childWeight, operator, timestamp)` 이벤트

---

### 5.7 F-06: 사용 매핑

**Actor**: Integrator (통합사)  
**목적**: 보유한 강재가 어떤 부품/제품에 사용되었는지 온체인에 기록한다

**기능 상세**:
- 사용할 강재 ID 선택 (자신이 보유한 ACTIVE 강재)
- 부품 ID (productId) 입력 (예: P_001)
- 부품 설명 (description) 입력 (예: "자동화 설비 A 프레임")
- 매핑 후 강재 상태 → USED로 변경

**출력**: `SteelUsed(steelId, productId, description, integrator, timestamp)` 이벤트

**비즈니스 규칙**:
- Integrator 역할 없는 지갑 → 거부
- 호출자가 소유하지 않은 강재 → 거부
- 강재 상태가 ACTIVE가 아닌 경우 → 거부

---

### 5.8 F-07: 이력 조회

**Actor**: 누구나 (읽기 전용, 트랜잭션 불필요)  
**목적**: 강재 ID 또는 부품 ID를 입력하여 전체 자재 이력 트리를 조회한다

**기능 상세 - 강재 ID 조회**:
- 입력: steelId
- 출력:
  - 강재 기본 정보 (등급, 무게, 상태, 발행자, 현재 소유자)
  - 화학 성분 + 기계적 성질
  - IPFS CID (PDF 다운로드 링크)
  - pdfHash (자동 검증 버튼)
  - 부모 강재 ID 목록 (재귀 조회 가능)
  - 자식 강재 ID 목록
  - 전체 트랜잭션 이력 (이벤트 로그)

**기능 상세 - 부품 ID 조회**:
- 입력: productId
- 출력:
  - 매핑된 강재 ID
  - 해당 강재부터 루트(제강사)까지 전체 트리
  - 각 노드의 MTC 정보

**시각화**:
- 부모-자식 트리를 웹 UI에서 시각적 그래프로 표현
- 각 노드 클릭 시 해당 강재의 상세 정보 팝업

---

### 5.9 F-08: PDF 업로드 및 해시 검증

**목적**: MTC PDF의 진본성을 SHA-256 해시로 자동 검증한다

**업로드 플로우**:
```
[Mill] PDF 파일 선택
  → 브라우저에서 SHA-256 해시 계산
  → Pinata API로 IPFS 업로드
  → CID 반환
  → 해시 + CID를 컨트랙트에 저장
```

**검증 플로우**:
```
[Auditor] 강재 조회 → IPFS PDF 다운로드 버튼 클릭
  → IPFS에서 PDF 다운로드
  → 브라우저에서 SHA-256 해시 계산
  → 온체인 pdfHash와 비교
  → 일치: "검증 완료 ✓" / 불일치: "위조 의심 ✗ 경고"
```

---

### 5.10 F-09: 역할 전환 UI (데모 전용)

**목적**: 시연자가 MetaMask 계정 전환 없이 현재 지갑의 활성 역할을 선택할 수 있도록 한다

**기능 상세**:
- Admin 계정 접속 시 역할 선택 드롭다운 표시
  - Admin 모드 / Mill 모드 / Fabricator 모드 / Integrator 모드 / Auditor 모드
- 선택된 역할에 따라 UI에서 사용 가능한 기능 변경
- 실제 컨트랙트 권한은 Admin이 모든 역할을 보유하므로 실제 트랜잭션은 정상 실행

---

### 5.11 F-10: 사기 시도 거부

컨트랙트가 자동으로 처리하는 사기 방지 규칙:

| 사기 유형 | 탐지 조건 | 거부 메시지 (UI 표시용) | Custom Error (§8.7) |
|---|---|---|---|
| 무게 부풀리기 | sum(자식) > sum(부모) | `WEIGHT_EXCEEDS_PARENT` | `WeightExceedsParent` |
| 권한 없는 발행 | msg.sender에 MILL_ROLE 없음 | `NOT_MILL` | `NotMill` |
| 이미 분할된 강재 재분할 | 강재 상태 ≠ ACTIVE | `STEEL_NOT_ACTIVE` | `SteelNotActive` |
| 소유자 아닌 자의 이전 | msg.sender ≠ 현재 소유자 | `NOT_OWNER` | `NotOwner` |
| 없는 강재 ID 조작 | steelId 미존재 | `STEEL_NOT_FOUND` | `SteelNotFound` |

> **표기 규칙**: "거부 메시지"는 UI 토스트·데모 시나리오에서 사용하는 가독성용 문자열이며, 실제 컨트랙트는 §8.7의 Solidity Custom Error로 구현한다. 프론트엔드의 `utils/errorMessages.js`가 Custom Error 이름을 UI 메시지로 변환한다.

---

## 6. 비기능 요구사항 (PRD)

### 6.1 성능
- 최대 동시 접속자: 10명 미만 (졸업과제 시연 환경)
- 트랜잭션 처리: Sepolia 테스트넷 기준 평균 12초 내 블록 확인
- 조회 응답시간: 2초 이내 (컨트랙트 view 함수 직접 호출)

### 6.2 가용성
- Cloudflare Pages 배포 → 99.9% 가용성 (정적 호스팅)
- 스마트 컨트랙트는 블록체인 위에 존재 → 별도 서버 관리 불필요

### 6.3 보안
- 모든 상태 변경은 서명된 트랜잭션 필요 (MetaMask)
- PDF 해시는 브라우저에서 계산 후 온체인 저장 → 서버 측 위변조 불가
- IPFS CID는 콘텐츠 주소 → 파일 변경 시 CID 자동 변경

### 6.4 호환성
- 브라우저: Chrome 최신 버전 (MetaMask 확장 필요)
- 지갑: MetaMask (v11+)
- 네트워크: Ethereum Sepolia Testnet (Chain ID: 11155111)

### 6.5 유지보수성
- 컨트랙트 소스 코드 Etherscan 검증(Verify) 등록
- 프론트엔드 코드 GitHub 공개 저장소
- 주요 함수 NatSpec 주석 작성

---

## 7. 시스템 아키텍처 (SRS)

### 7.1 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              React + Vite 프론트엔드                      │   │
│  │   (Cloudflare Pages 배포, 정적 사이트)                    │   │
│  │                                                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │  컨트랙트 UI  │  │  이력 조회 UI │  │  PDF 검증 UI│  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │   │
│  │         │                 │                  │          │   │
│  │  ┌──────▼─────────────────▼──────────────────▼──────┐  │   │
│  │  │              ethers.js / wagmi                    │  │   │
│  │  └───────────┬──────────────────────────────────────┘  │   │
│  └──────────────┼──────────────────────────────────────────┘   │
│                 │                                                │
│  ┌──────────────▼──────────────────────────────────────────┐   │
│  │                    MetaMask 지갑                          │   │
│  └──────────────┬──────────────────────────────────────────┘   │
└─────────────────┼────────────────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │ JSON-RPC            │ REST API
        ▼ (트랜잭션 서명)     ▼ (메타데이터 조회/저장)
┌───────────────────┐  ┌──────────────────────────────────────┐
│ Ethereum Sepolia  │  │  Cloudflare Workers (백엔드 API)      │
│  ┌─────────────┐  │  │  ┌──────────────────────────────┐   │
│  │MtcRegistry  │  │  │  │ /api/metadata/:steelId        │   │
│  │.sol         │  │  │  │ /api/metadata (POST)          │   │
│  │- 역할관리   │  │  │  │ /api/product/:productId       │   │
│  │- 소유권     │  │  │  └──────────────┬───────────────┘   │
│  │- 무게검증   │  │  │                 │                    │
│  │- 상태관리   │  │  │  ┌──────────────▼───────────────┐   │
│  │- 이벤트로그 │  │  │  │  Cloudflare KV               │   │
│  └─────────────┘  │  │  │  key: steelId                │   │
└───────────────────┘  │  │  val: {grade, chem*, mech*,  │   │
                       │  │        productDesc, ...}      │   │
                       │  └──────────────────────────────┘   │
                       └──────────────────────────────────────┘
                                        │
               ┌────────────────────────┘
               ▼
       ┌───────────────┐
       │  IPFS (Pinata) │
       │ MTC PDF 저장   │
       │ CID 기반 접근  │
       └───────────────┘
```

**데이터 분리 원칙**:
- **블록체인**: 신뢰가 요구되는 핵심 데이터 (소유권, 무게, PDF 해시, 상태, 이력 트리)
- **서버(KV)**: 표시용 메타데이터 (등급, 화학성분, 기계적성질, 부품설명) — PDF 해시가 진본성을 보증하므로 서버 저장으로 충분
- **IPFS**: MTC PDF 원본 (변경 시 CID 자동 변경 → 해시 불일치 감지)

### 7.2 기술 스택

| 레이어 | 기술 | 버전 | 이유 |
|---|---|---|---|
| 블록체인 | Ethereum Sepolia | - | 무료 테스트넷, MetaMask 기본 지원 |
| 컨트랙트 언어 | Solidity | ^0.8.20 | 최신 안정 버전 |
| 컨트랙트 프레임워크 | Hardhat | ^2.22 | 로컬 테스트, 배포 스크립트 |
| 컨트랙트 라이브러리 | OpenZeppelin | ^5.0 | AccessControl, 보안 검증 |
| **백엔드 API** | **Cloudflare Workers** | **-** | **서버리스, Cloudflare Pages와 동일 플랫폼** |
| **메타데이터 저장** | **Cloudflare KV** | **-** | **Workers와 통합, 무료 티어 충분** |
| 프론트엔드 프레임워크 | React | ^18 | 컴포넌트 기반 UI |
| 빌드 도구 | Vite | ^5 | 빠른 개발 서버, 경량 번들 |
| Web3 연동 | ethers.js | ^6 | 컨트랙트 호출, MetaMask 연동 |
| IPFS 업로드 | Pinata SDK | ^1 | 무료 티어, REST API 안정적 |
| CSS | Tailwind CSS | ^3 | 빠른 스타일링 |
| 트리 시각화 | React Flow | ^11 | 부모-자식 트리 그래프 |
| 배포 (프론트엔드) | Cloudflare Pages | - | 무료 정적 호스팅, CDN |
| 배포 (API) | Cloudflare Workers | - | Pages와 동일 계정, 무료 티어 |
| 버전 관리 | GitHub | - | CI/CD 연동 |

### 7.3 스마트 컨트랙트 구조

```
contracts/
└── MtcRegistry.sol         # 단일 컨트랙트 (졸업과제 범위)
    ├── AccessControl        # 역할 관리 (OpenZeppelin 상속)
    ├── struct Steel         # 핵심 강재 데이터 (신뢰 필수 항목만)
    ├── mapping steels       # steelId → Steel
    ├── mapping productMap   # productId → steelId
    └── Events               # 모든 상태 변경 이벤트

worker/
├── src/
│   └── index.js            # Cloudflare Workers 진입점
│       ├── GET  /api/metadata/:steelId    # 강재 메타데이터 조회
│       ├── POST /api/metadata             # 강재 메타데이터 저장 (MTC 발행 시)
│       └── GET  /api/product/:productId   # 부품 설명 조회
└── wrangler.toml            # Workers 배포 설정 (KV 바인딩 포함)
```

### 7.4 프론트엔드 구조

```
src/
├── main.jsx                    # 진입점
├── App.jsx                     # 라우팅
├── components/
│   ├── layout/
│   │   ├── Header.jsx          # 지갑 연결, 역할 표시
│   │   └── RoleSwitcher.jsx    # Admin용 역할 전환 드롭다운
│   ├── admin/
│   │   └── RoleManager.jsx     # 역할 등록/해제 UI
│   ├── mill/
│   │   └── MtcIssuance.jsx     # MTC 발행 폼
│   ├── fabricator/
│   │   ├── SteelSplit.jsx      # 분할 UI
│   │   └── SteelCombine.jsx    # 조합 UI
│   ├── integrator/
│   │   └── SteelUsage.jsx      # 사용 매핑 UI
│   ├── auditor/
│   │   ├── SearchPanel.jsx     # 강재/부품 ID 검색
│   │   ├── SteelDetail.jsx     # 강재 상세 정보
│   │   ├── AncestryTree.jsx    # 이력 트리 시각화 (React Flow)
│   │   └── PdfVerifier.jsx     # PDF 다운로드 + 해시 검증
│   └── common/
│       ├── TxStatus.jsx        # 트랜잭션 상태 표시
│       └── EventLog.jsx        # 이벤트 로그 패널
├── hooks/
│   ├── useContract.js          # 컨트랙트 인스턴스 훅
│   ├── useWallet.js            # MetaMask 연결 훅
│   └── useRole.js              # 현재 역할 상태 훅
├── utils/
│   ├── ipfs.js                 # Pinata 업로드 유틸
│   ├── hash.js                 # SHA-256 해시 유틸
│   └── format.js               # 단위 변환 (g ↔ kg 등)
└── constants/
    ├── abi.js                  # 컨트랙트 ABI
    └── addresses.js            # 배포 컨트랙트 주소
```

---

## 8. 스마트 컨트랙트 명세 (SRS)

### 8.1 역할 상수 정의

```solidity
bytes32 public constant MILL_ROLE       = keccak256("MILL_ROLE");
bytes32 public constant FABRICATOR_ROLE = keccak256("FABRICATOR_ROLE");
bytes32 public constant INTEGRATOR_ROLE = keccak256("INTEGRATOR_ROLE");
// DEFAULT_ADMIN_ROLE은 OpenZeppelin에서 0x00으로 정의됨
```

### 8.2 상태 열거형 (SteelStatus)

```solidity
enum SteelStatus {
    ACTIVE,     // 현재 사용 가능 상태
    SPLIT,      // 분할 완료 (원본 소비됨)
    COMBINED,   // 조합 원료로 사용됨 (원본 소비됨)
    USED        // 최종 제품에 사용됨
}
```

### 8.3 강재 구조체 (Steel)

온체인에는 신뢰가 반드시 필요한 핵심 항목만 저장한다. 표시용 메타데이터(등급, 화학성분, 기계적성질)는 서버(Cloudflare KV)에서 관리한다.

```solidity
struct Steel {
    string  steelId;          // Heat Number (예: H_001)
    uint256 weight;           // 무게 (g 단위 정수) — 무게 보존 법칙 검사에 필수

    // 문서 진본성 증명
    string  ipfsCid;          // IPFS CID — 누구나 PDF에 독립적으로 접근 가능
    bytes32 pdfHash;          // PDF SHA-256 해시 — 위변조 감지 핵심

    // 소유권 및 상태
    SteelStatus status;       // ACTIVE / SPLIT / COMBINED / USED — 상태 전이 강제
    address mill;             // 발행한 제강사 주소
    address owner;            // 현재 소유자 주소
    uint256 createdAt;        // 발행 블록 타임스탬프

    // 이력 연결 (트리 추적)
    string[] parentIds;       // 부모 강재 ID 목록
    string[] childIds;        // 자식 강재 ID 목록
}
```

**서버(Cloudflare KV)에서 관리하는 메타데이터** (steelId 키로 저장):

```json
{
  "grade": "SS400",
  "chemC": 0.170,
  "chemSi": 0.250,
  "chemMn": 1.200,
  "chemP": 0.035,
  "chemS": 0.030,
  "yieldStrength": 245,
  "tensileStrength": 400,
  "elongation": 21
}
```

> **근거**: 등급·화학성분·기계적성질은 PDF에 이미 존재한다. PDF 해시(pdfHash)가 온체인에 있으므로, 이 수치들의 진본성은 PDF 검증으로 보장된다. 해당 데이터를 온체인에 추가 저장하는 것은 가스 낭비일 뿐 신뢰를 높이지 않는다.

### 8.4 핵심 매핑

```solidity
mapping(string => Steel)       private steels;        // steelId → Steel
mapping(string => bool)        private steelExists;   // steelId 존재 여부
mapping(string => string)      private productMap;    // productId → steelId
// productDesc 제거: 부품 설명은 서버(KV)에서 관리
```

### 8.5 함수 명세

#### 8.5.1 grantMill / grantFabricator / grantIntegrator

```solidity
/// @notice 지갑 주소에 역할을 부여한다
/// @param account 역할을 부여할 지갑 주소
function grantMill(address account) external onlyRole(DEFAULT_ADMIN_ROLE)
function grantFabricator(address account) external onlyRole(DEFAULT_ADMIN_ROLE)
function grantIntegrator(address account) external onlyRole(DEFAULT_ADMIN_ROLE)

/// @notice 역할을 해제한다
function revokeMill(address account) external onlyRole(DEFAULT_ADMIN_ROLE)
function revokeFabricator(address account) external onlyRole(DEFAULT_ADMIN_ROLE)
function revokeIntegrator(address account) external onlyRole(DEFAULT_ADMIN_ROLE)
```

#### 8.5.2 issueMtc

```solidity
/// @notice 새로운 강재 MTC를 발행한다
/// @dev steelId 중복 불가. weight > 0, pdfHash != 0 필요.
/// @dev grade·화학성분·기계적성질은 컨트랙트 파라미터에서 제거 — 서버에서 저장
/// @dev onlyRole 수정자 대신 수동 체크를 사용하여 Custom Error(NotMill)를 발생시킨다
function issueMtc(
    string calldata steelId,
    uint256 weight,
    string calldata ipfsCid,
    bytes32 pdfHash
) external {
    if (!hasRole(MILL_ROLE, msg.sender)) revert NotMill();

    // 검증 조건 (가독성 목적으로 require 형식 표기 — 실제 구현은 §8.7 Custom Error + revert 사용)
    require(!steelExists[steelId], "STEEL_EXISTS");       // → revert SteelExists(steelId)
    require(weight > 0, "INVALID_WEIGHT");                 // → revert InvalidWeight()
    require(pdfHash != bytes32(0), "INVALID_PDF_HASH");    // → revert InvalidPdfHash()
    require(bytes(ipfsCid).length > 0, "INVALID_CID");    // → revert InvalidCid()
}

emit SteelMinted(steelId, msg.sender, weight, ipfsCid, pdfHash, block.timestamp);
```

> **구현 주의**: `onlyRole(MILL_ROLE)` 수정자는 OpenZeppelin의 `AccessControlUnauthorizedAccount` 에러를 발생시켜 프론트엔드에서 커스텀 메시지 매핑이 어렵다. 역할 관련 함수(issueMtc, splitSteel, combineSteel, markAsUsed)는 수동 `if (!hasRole(...)) revert CustomError()` 패턴을 사용한다.

> **프론트엔드 처리**: MTC 발행 시 컨트랙트 트랜잭션과 함께 서버 API `POST /api/metadata`에도 메타데이터를 저장한다. 컨트랙트 트랜잭션이 실패하면 서버 저장도 롤백(서버 데이터 삭제)한다.

#### 8.5.3 transferOwnership

```solidity
/// @notice 강재 소유권을 이전한다
function transferOwnership(
    string calldata steelId,
    address to
) external

// 검증 조건 (가독성 목적으로 require 형식 표기 — 실제 구현은 §8.7 Custom Error + revert 사용)
require(steelExists[steelId], "STEEL_NOT_FOUND");    // → revert SteelNotFound(steelId)
require(steels[steelId].owner == msg.sender, "NOT_OWNER");           // → revert NotOwner(...)
require(steels[steelId].status == SteelStatus.ACTIVE, "STEEL_NOT_ACTIVE"); // → revert SteelNotActive(...)
require(
    hasRole(FABRICATOR_ROLE, to) ||
    hasRole(INTEGRATOR_ROLE, to) ||
    hasRole(DEFAULT_ADMIN_ROLE, to),
    "INVALID_RECIPIENT"                              // → revert InvalidRecipient(to)
);

emit SteelOwnershipTransferred(steelId, msg.sender, to, block.timestamp);
```

#### 8.5.4 splitSteel

```solidity
/// @notice 강재를 N개로 분할한다
/// @param parentId 분할할 부모 강재 ID
/// @param childWeights 각 자식의 무게 배열 (g 단위)
/// @return childIds 생성된 자식 강재 ID 배열 (프론트엔드는 SteelSplit 이벤트에서 읽을 것)
function splitSteel(
    string calldata parentId,
    uint256[] calldata childWeights
) external returns (string[] memory childIds) {
    if (!hasRole(FABRICATOR_ROLE, msg.sender)) revert NotFabricator();

    // 검증 조건 (가독성 목적으로 require 형식 표기 — 실제 구현은 §8.7 Custom Error + revert 사용)
    require(steelExists[parentId], "STEEL_NOT_FOUND");   // → revert SteelNotFound(parentId)
    require(steels[parentId].owner == msg.sender, "NOT_OWNER");          // → revert NotOwner(...)
    require(steels[parentId].status == SteelStatus.ACTIVE, "STEEL_NOT_ACTIVE"); // → revert SteelNotActive(...)
    require(childWeights.length >= 2 && childWeights.length <= 10, "INVALID_CHILD_COUNT"); // → revert InvalidChildCount(n)

    for (uint i = 0; i < childWeights.length; i++) {
        require(childWeights[i] > 0, "INVALID_WEIGHT");  // → revert InvalidWeight()
        // 자동 생성 childId = "{parentId}_{i+1}"
        // require(!steelExists[childId], "CHILD_STEEL_EXISTS"); // → revert SteelExists(childId)
    }

    uint256 totalChildWeight = sum(childWeights);
    // 안전한 산술: weight * 90 / 100 대신 totalChildWeight * 100 >= weight * 90 으로 overflow 방지
    require(totalChildWeight <= steels[parentId].weight, "WEIGHT_EXCEEDS_PARENT");
    require(totalChildWeight * 100 >= steels[parentId].weight * 90, "WEIGHT_LOSS_EXCEEDED");
}

emit SteelSplit(parentId, childIds, steels[parentId].weight, childWeights, msg.sender, block.timestamp);
```

> **반환값 주의**: `splitSteel`의 반환값 `childIds`는 트랜잭션 컨텍스트에서 외부로 전달되지 않는다. 프론트엔드는 트랜잭션 영수증에서 `SteelSplit` 이벤트를 파싱하여 `childIds`를 획득해야 한다.

#### 8.5.5 combineSteel

```solidity
/// @notice N개 강재를 1개로 조합한다
/// @param parentIds 부모 강재 ID 배열
/// @param childId 생성될 자식 강재 ID
/// @param childWeight 자식 강재 무게 (g 단위)
/// @dev grade는 서버에서 저장 — 컨트랙트 파라미터 불필요
function combineSteel(
    string[] calldata parentIds,
    string calldata childId,
    uint256 childWeight,
    string calldata ipfsCid,
    bytes32 pdfHash
) external onlyRole(FABRICATOR_ROLE)

    if (!hasRole(FABRICATOR_ROLE, msg.sender)) revert NotFabricator();

    // 검증 조건 (가독성 목적으로 require 형식 표기 — 실제 구현은 §8.7 Custom Error + revert 사용)
    require(parentIds.length >= 2 && parentIds.length <= 10, "INVALID_PARENT_COUNT"); // → revert InvalidParentCount(n)
    require(!steelExists[childId], "CHILD_STEEL_EXISTS");    // → revert SteelExists(childId)
    // 각 parentId: exists → revert SteelNotFound / owner == msg.sender → revert NotOwner / status == ACTIVE → revert SteelNotActive

    // totalParentWeight = 루프로 steels[parentIds[i]].weight 합산 (파라미터 아님)
    uint256 totalParentWeight = 0;
    for (uint i = 0; i < parentIds.length; i++) {
        require(steelExists[parentIds[i]], "STEEL_NOT_FOUND");
        require(steels[parentIds[i]].owner == msg.sender, "NOT_OWNER");
        require(steels[parentIds[i]].status == SteelStatus.ACTIVE, "STEEL_NOT_ACTIVE");
        totalParentWeight += steels[parentIds[i]].weight;
    }

    // 안전한 산술: childWeight * 100 >= totalParentWeight * 85 으로 overflow 방지
    require(childWeight <= totalParentWeight, "WEIGHT_EXCEEDS_PARENTS"); // → revert WeightExceedsParent(...)
    require(childWeight * 100 >= totalParentWeight * 85, "WEIGHT_LOSS_EXCEEDED"); // → revert WeightLossExceeded(...)

emit SteelCombined(parentIds, childId, totalParentWeight, childWeight, msg.sender, block.timestamp);
```

#### 8.5.6 markAsUsed

```solidity
/// @notice 강재를 부품에 사용 등록한다
/// @dev description은 서버에서 저장 — 온체인 필요 없음
function markAsUsed(
    string calldata steelId,
    string calldata productId
) external onlyRole(INTEGRATOR_ROLE)

    if (!hasRole(INTEGRATOR_ROLE, msg.sender)) revert NotIntegrator();

    // 검증 조건 (가독성 목적으로 require 형식 표기 — 실제 구현은 §8.7 Custom Error + revert 사용)
    require(steelExists[steelId], "STEEL_NOT_FOUND");    // → revert SteelNotFound(steelId)
    require(steels[steelId].owner == msg.sender, "NOT_OWNER");           // → revert NotOwner(...)
    require(steels[steelId].status == SteelStatus.ACTIVE, "STEEL_NOT_ACTIVE"); // → revert SteelNotActive(...)
    require(bytes(productId).length > 0, "INVALID_PRODUCT_ID");         // → revert InvalidProductId()

emit SteelUsed(steelId, productId, msg.sender, block.timestamp);
```

> **프론트엔드 처리**: 부품 설명(description)은 `POST /api/product` API로 서버에 저장한다.

#### 8.5.7 조회 함수 (view)

```solidity
/// @notice 강재 기본 정보 조회
function getSteel(string calldata steelId)
    external view returns (Steel memory)

/// @notice 부모 강재 ID 목록 조회
function getParents(string calldata steelId)
    external view returns (string[] memory)

/// @notice 자식 강재 ID 목록 조회
function getChildren(string calldata steelId)
    external view returns (string[] memory)

/// @notice 부품 ID로 강재 ID 조회
/// @dev description은 서버(KV)에서 관리하므로 컨트랙트는 steelId만 반환한다
function getSteelByProduct(string calldata productId)
    external view returns (string memory steelId)

/// @notice 역할 보유 여부 조회
function hasMillRole(address account) external view returns (bool)
function hasFabricatorRole(address account) external view returns (bool)
function hasIntegratorRole(address account) external view returns (bool)
```

### 8.6 이벤트 정의

```solidity
// RoleGranted / RoleRevoked 는 OpenZeppelin AccessControl 에서 상속됨 — 재선언 불가
// (재선언 시 컴파일 에러: "Event with same name and parameter types defined twice")
// event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);  ← OpenZeppelin 제공
// event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);  ← OpenZeppelin 제공

// ── string indexed 주의사항 ────────────────────────────────────────────────────
// Solidity에서 string/bytes 타입에 indexed를 붙이면 keccak256 해시만 topics에 저장됨.
// ethers.js v6에서 event.args.steelId 등은 null을 반환하여 UI 표시 불가.
// → string 파라미터는 indexed 제거. address/bytes32만 indexed 사용.
// ──────────────────────────────────────────────────────────────────────────────

event SteelMinted(
    string steelId,            // indexed 제거: UI에서 값 읽기 가능
    address indexed mill,      // address는 indexed 가능
    uint256 weight,
    string ipfsCid,
    bytes32 indexed pdfHash,   // bytes32는 indexed로 온전히 저장됨 (필터링 가능)
    uint256 timestamp
);

event SteelOwnershipTransferred(  // OpenZeppelin Ownable의 OwnershipTransferred와 이름 충돌 방지
    string steelId,            // indexed 제거
    address indexed from,
    address indexed to,
    uint256 timestamp
);

event SteelSplit(
    string parentId,           // indexed 제거
    string[] childIds,         // 배열 — non-indexed, ABI 디코딩으로 읽기 가능
    uint256 parentWeight,
    uint256[] childWeights,
    address indexed operator,
    uint256 timestamp
);

event SteelCombined(
    string[] parentIds,        // 배열 — non-indexed
    string childId,            // indexed 제거
    uint256 totalParentWeight,
    uint256 childWeight,
    address indexed operator,
    uint256 timestamp
);

event SteelUsed(
    string steelId,            // indexed 제거
    string productId,          // indexed 제거 (description 제거 — 서버에서 관리)
    address indexed integrator,
    uint256 timestamp
);
```

> **이벤트 인덱싱 규칙**: `address`, `bytes32`, `uint256` 등 고정 크기 값 타입만 `indexed`로 지정한다. `string`, `bytes`, 동적 배열에 `indexed`를 붙이면 keccak256 해시가 저장되어 원본 값을 복구할 수 없다. 필터링에는 사용 가능하지만 UI 표시에는 사용 불가하므로 본 프로젝트에서는 string indexed를 사용하지 않는다.

### 8.7 에러 코드 정의 (Custom Errors)

```solidity
// ── 강재 존재·상태 관련 ──────────────────────────────────────────────────────
error SteelExists(string steelId);                           // 중복 steelId 등록 시도
error SteelNotFound(string steelId);                         // 존재하지 않는 steelId 참조
error SteelNotActive(string steelId, SteelStatus current);   // ACTIVE 아닌 강재에 작업 시도

// ── 소유권 관련 ──────────────────────────────────────────────────────────────
error NotOwner(string steelId, address caller, address owner); // 소유자 아닌 자의 조작 시도
error InvalidRecipient(address recipient);                   // 미등록 수신자에게 이전 시도

// ── 무게 관련 ─────────────────────────────────────────────────────────────────
error WeightExceedsParent(uint256 childTotal, uint256 parentWeight); // 자식 합계 > 부모
error WeightLossExceeded(uint256 childTotal, uint256 minRequired);   // 손실률 초과

// ── 입력값 관련 ──────────────────────────────────────────────────────────────
error InvalidWeight();            // weight == 0 (issueMtc, splitSteel)
error InvalidPdfHash();           // pdfHash == bytes32(0) (issueMtc, combineSteel)
error InvalidCid();               // ipfsCid 빈 문자열 (issueMtc, combineSteel)
error InvalidChildCount(uint256 count);  // 자식 수 < 2 또는 > 10 (splitSteel)
error InvalidProductId();         // productId 빈 문자열 (markAsUsed)

// ── 역할 관련 ─────────────────────────────────────────────────────────────────
error NotMill();
error NotFabricator();
error NotIntegrator();

// ── 조합 관련 ─────────────────────────────────────────────────────────────────
error NeedMultipleParents();                  // 부모 강재 1개뿐인 조합 시도 (combineSteel)
error InvalidParentCount(uint256 count);      // 부모 수 < 2 또는 > 10 (combineSteel)
```

> **역할 에러 주의**: `NotMill`, `NotFabricator`, `NotIntegrator`는 `onlyRole` 수정자 대신 수동 체크 패턴(`if (!hasRole(...)) revert NotXxx()`)으로만 발생한다. `onlyRole` 수정자를 사용하면 OpenZeppelin의 `AccessControlUnauthorizedAccount(address account, bytes32 neededRole)`가 발생하며, 이는 `errorMessages.js`에서 별도 처리가 필요하다.

---

## 9. 데이터 모델 (SRS)

### 9.1 온체인 데이터 (스마트 컨트랙트 스토리지)

신뢰가 반드시 필요한 항목만 블록체인에 저장한다.

| 필드 | 타입 | 저장 위치 | 블록체인 필요 이유 |
|---|---|---|---|
| steelId | string | mapping key | 고유 식별자 — 중복 방지를 컨트랙트가 강제 |
| weight | uint256 | Steel struct | 무게 보존 법칙 검사에 필수 |
| pdfHash | bytes32 | Steel struct | 위변조 감지 — 핵심 가치 제안 |
| ipfsCid | string | Steel struct | 누구나 독립적으로 PDF 접근 가능하게 |
| status | enum | Steel struct | 상태 전이 규칙을 컨트랙트가 자동 강제 |
| mill | address | Steel struct | 발행 주체 추적 — 위조 불가 |
| owner | address | Steel struct | 소유권 이전 권한 검사에 필수 |
| createdAt | uint256 | Steel struct | 블록 타임스탬프 — 변경 불가 |
| parentIds | string[] | Steel struct | 이력 트리 추적 — 신뢰 기관 없이 검증 |
| childIds | string[] | Steel struct | 이력 트리 추적 |
| productId→steelId | string | productMap | 부품으로 강재 역추적 — 조회자 신뢰 |

### 9.2 서버 데이터 (Cloudflare KV)

표시용 메타데이터. PDF 해시가 진본성을 보증하므로 서버 저장으로 충분하다.

**KV key**: `steel:{steelId}` → JSON value

| 필드 | 설명 | 비고 |
|---|---|---|
| grade | 강재 등급 (SS400, SM490 등) | PDF에도 존재 |
| chemC | 탄소 함량 (%) | PDF에도 존재 |
| chemSi | 규소 함량 (%) | PDF에도 존재 |
| chemMn | 망간 함량 (%) | PDF에도 존재 |
| chemP | 인 함량 (%) | PDF에도 존재 |
| chemS | 황 함량 (%) | PDF에도 존재 |
| yieldStrength | 항복강도 (MPa) | PDF에도 존재 |
| tensileStrength | 인장강도 (MPa) | PDF에도 존재 |
| elongation | 연신율 (%) | PDF에도 존재 |

**KV key**: `product:{productId}` → JSON value

| 필드 | 설명 |
|---|---|
| description | 부품 설명 텍스트 (예: "자동화 설비 A 프레임") |

### 9.3 IPFS 데이터 (오프체인)

| 항목 | 형식 | 접근 방법 |
|---|---|---|
| MTC PDF 원본 | application/pdf | `https://ipfs.io/ipfs/{CID}` |
| 조합 강재의 새 MTC | application/pdf | 동일 |

### 9.4 클라이언트 측 임시 데이터 (브라우저 메모리)

| 항목 | 설명 |
|---|---|
| 연결된 지갑 주소 | MetaMask provider에서 실시간 조회 |
| 현재 선택 역할 | React 상태 (localStorage 저장 가능) |
| 조회 이력 트리 | 블록체인 + 서버 응답 병합 캐시 (세션 내) |

### 9.5 데이터 흐름 다이어그램

```
[Mill — MTC 발행]
  1. PDF 파일 선택
  2. 브라우저: SHA-256(PDF) → pdfHash
  3. Pinata API: upload(PDF) → CID
  4. MetaMask: issueMtc(steelId, weight, CID, pdfHash) 서명  ← 핵심만
  5. Sepolia: 트랜잭션 확인 → SteelMinted 이벤트
  6. POST /api/metadata { steelId, grade, chem*, mech* }     ← 메타데이터는 서버로
     (트랜잭션 실패 시 이 단계 생략)

[Auditor — 이력 조회]
  1. steelId 입력
  2. 병렬 호출:
     a. ethers.js: getSteel(steelId) → Steel struct (신뢰 데이터)
     b. GET /api/metadata/:steelId → 메타데이터 JSON (표시용)
  3. 재귀: getParents(steelId) → 루트까지 트리 구성
  4. React Flow: 트리 시각화 렌더링
  5. "PDF 검증" 클릭:
     - IPFS: fetch(CID) → PDF 바이너리
     - 브라우저: SHA-256(PDF) → calculatedHash
     - 비교: calculatedHash === steel.pdfHash ? 검증완료 : 위조경고
     ※ 서버 메타데이터가 조작되어도 PDF 해시 검증으로 즉시 탐지 가능
```

---

## 10. 프론트엔드 명세 (SRS)

### 10.1 페이지 구성 및 라우팅

| 경로 | 페이지명 | 접근 권한 |
|---|---|---|
| `/` | 메인 (검색) | 누구나 |
| `/search` | 강재/부품 ID 조회 | 누구나 |
| `/admin` | 역할 관리 | Admin |
| `/issue` | MTC 발행 | Mill (Admin 포함) |
| `/split` | 강재 분할 | Fabricator (Admin 포함) |
| `/combine` | 강재 조합 | Fabricator (Admin 포함) |
| `/usage` | 사용 매핑 | Integrator (Admin 포함) |
| `/transfer` | 소유권 이전 | Mill/Fabricator (Admin 포함) |

### 10.2 Header 컴포넌트

- MetaMask 연결 버튼 / 연결된 주소 표시 (앞 6자 + ... + 뒤 4자)
- 현재 네트워크 표시 (Sepolia 이외 네트워크 접속 시 경고)
- 현재 역할 배지 (색상 코드별 구분)
- Admin 접속 시 역할 선택 드롭다운

**역할 배지 색상**:
| 역할 | 색상 |
|---|---|
| Admin | 보라 (#7C3AED) |
| Mill (제강사) | 파랑 (#2563EB) |
| Fabricator (가공사) | 초록 (#059669) |
| Integrator (통합사) | 주황 (#D97706) |
| Auditor (조회자) | 회색 (#6B7280) |

### 10.3 MTC 발행 폼 (Mill)

**섹션 1: 강재 기본 정보**
- 강재 ID (steelId): 텍스트 입력, 영문/숫자/언더스코어 허용
- 강재 등급 (grade): 드롭다운 (SS400, SM490, SMA490W, A36, S355, 직접입력)
- 무게 (kg): 숫자 입력, 소수점 1자리

**섹션 2: 화학 성분 (%)**
- C, Si, Mn, P, S: 숫자 입력, 소수점 3자리

**섹션 3: 기계적 성질**
- 항복강도 (MPa), 인장강도 (MPa), 연신율 (%): 숫자 입력

**섹션 4: PDF 업로드**
- 파일 선택 버튼 (accept: .pdf)
- 업로드 진행 표시바
- IPFS CID 표시 (업로드 완료 후)
- PDF 해시 미리보기 (SHA-256)

**섹션 5: 발행 버튼**
- "MetaMask로 발행" 버튼 → 트랜잭션 전송
- 트랜잭션 해시 링크 (Etherscan Sepolia)

### 10.4 이력 트리 시각화 (React Flow)

```
노드 구성:
- 각 강재 ID = 하나의 노드
- 노드 색상: 상태(ACTIVE/SPLIT/COMBINED/USED)에 따라 구분
- 노드 클릭: 해당 강재의 상세 정보 사이드 패널 표시
- 엣지: 부모→자식 방향 화살표

예시 트리:
         [H_001 POSCO] ─────────────[OTHER_001 HYUNDAI]
               │                           │
         [H_001_SPLIT_1]              [H_001_SPLIT_2]
               └───────────┬───────────────┘
                       [PIPE_001]
                           │
                       [P_001 사용됨]
```

노드 색상 코드:
- ACTIVE: 초록 테두리
- SPLIT: 노란 테두리 (소비됨)
- COMBINED: 주황 테두리 (소비됨)
- USED: 회색 테두리 (최종 사용)

### 10.5 트랜잭션 상태 알림

모든 트랜잭션 전송 시 UI 하단에 토스트 알림:
1. "트랜잭션 전송 중..." (스피너)
2. "블록 확인 대기 중... (TX: 0x...)" (Etherscan 링크 포함)
3. 성공: "완료! 블록 {번호}에 기록됨 ✓" (초록)
4. 실패: "거부됨: {revert 메시지}" (빨강)

---

## 11. IPFS 연동 명세 (SRS)

### 11.1 Pinata 설정

- 서비스: Pinata (https://pinata.cloud)
- 플랜: 무료 (1GB 저장, 10만 요청/월)
- 인증: API Key + API Secret (환경변수 `VITE_PINATA_API_KEY`, `VITE_PINATA_API_SECRET`)
- Gateway: `https://gateway.pinata.cloud/ipfs/{CID}` (공개 접근)

> **보안 주의**: Pinata API Key는 `.env.local`에 저장, `.gitignore`로 제외. 프론트엔드 번들에 포함되므로 쓰기 권한만 있는 제한적 키 사용.

### 11.2 PDF 업로드 플로우

```javascript
// utils/ipfs.js
async function uploadPdfToIpfs(file) {
    // 1. SHA-256 해시 계산 (Web Crypto API)
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const pdfHash = '0x' + Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    // 2. Pinata 업로드
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
            pinata_api_key: import.meta.env.VITE_PINATA_API_KEY,
            pinata_secret_api_key: import.meta.env.VITE_PINATA_API_SECRET,
        },
        body: formData,
    });
    const { IpfsHash: cid } = await response.json();

    return { cid, pdfHash };
}
```

### 11.3 PDF 검증 플로우

```javascript
// utils/hash.js
async function verifyPdf(cid, onchainHash) {
    // 1. IPFS에서 PDF 다운로드
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    const arrayBuffer = await response.arrayBuffer();

    // 2. SHA-256 재계산
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const calculatedHash = '0x' + Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

    // 3. 온체인 해시와 비교
    return {
        isValid: calculatedHash.toLowerCase() === onchainHash.toLowerCase(),
        calculatedHash,
        onchainHash,
    };
}
```

---

## 11-B. 백엔드 API 명세 (Cloudflare Workers + KV)

### 11-B.1 개요

블록체인에 저장하지 않는 메타데이터(등급, 화학성분, 기계적성질, 부품설명)를 관리하는 서버리스 API.

- **런타임**: Cloudflare Workers
- **저장소**: Cloudflare KV (`MTC_METADATA` 네임스페이스)
- **인증**: Workers 자체 인증 없음 (쓰기는 프론트엔드 요청에 비밀 키 헤더로 제한)
- **일관성 주의**: Cloudflare KV는 **최종 일관성(eventual consistency)** 모델이다. `POST /api/metadata` 직후 `GET /api/metadata/:steelId`를 호출하면 엣지 캐시가 아직 전파되지 않아 404 또는 이전 값이 반환될 수 있다. 프론트엔드는 MTC 발행 후 조회 화면으로 이동 시 블록체인 데이터(온체인)를 먼저 표시하고, KV 메타데이터는 최초 조회 실패 시 1~2회 재시도 로직을 추가하는 것이 권장된다.

### 11-B.2 엔드포인트

#### GET /api/metadata/:steelId

강재 메타데이터 조회.

```
Response 200:
{
  "grade": "SS400",
  "chemC": 0.170,
  "chemSi": 0.250,
  "chemMn": 1.200,
  "chemP": 0.035,
  "chemS": 0.030,
  "yieldStrength": 245,
  "tensileStrength": 400,
  "elongation": 21
}

Response 404: { "error": "not found" }
```

#### POST /api/metadata

강재 메타데이터 저장 (MTC 발행 시 프론트엔드가 호출).

```
Request Header: X-Api-Key: {VITE_WORKERS_API_KEY}
Request Body:
{
  "steelId": "H_001",
  "grade": "SS400",
  "chemC": 0.170, "chemSi": 0.250, "chemMn": 1.200,
  "chemP": 0.035, "chemS": 0.030,
  "yieldStrength": 245, "tensileStrength": 400, "elongation": 21
}

Response 200: { "ok": true }
Response 409: { "error": "already exists" }  // 중복 방지
```

#### GET /api/product/:productId

부품 설명 조회.

```
Response 200: { "description": "자동화 설비 A 프레임" }
Response 404: { "error": "not found" }
```

#### POST /api/product

부품 설명 저장 (사용 매핑 시 프론트엔드가 호출).

```
Request Header: X-Api-Key: {VITE_WORKERS_API_KEY}
Request Body: { "productId": "P_001", "description": "자동화 설비 A 프레임" }
Response 200: { "ok": true }
```

### 11-B.3 환경변수 추가

```
# Cloudflare Pages 환경변수
VITE_WORKERS_API_URL=https://mtc-api.{account}.workers.dev
VITE_WORKERS_API_KEY=...   # Workers 쓰기 보호용 간단 시크릿
```

### 11-B.4 프론트엔드 병렬 조회 패턴

```javascript
// utils/api.js
async function getSteelFull(steelId) {
    const [onchain, meta] = await Promise.all([
        contract.getSteel(steelId),           // 블록체인 (신뢰 데이터)
        fetch(`${API_URL}/api/metadata/${steelId}`).then(r => r.json()), // 서버 (표시용)
    ]);
    return { ...onchain, ...meta };
}
```

---

## 12. 데모 시연 시나리오 (SRS)

> **전제**: Admin 지갑이 MetaMask에 연결되어 있음. Sepolia ETH 보유.

### Scenario 1: 역할 등록

**Actor**: Admin  
**목적**: 데모 참여 지갑 주소에 역할 부여

**단계**:
1. `/admin` 페이지 접속
2. POSCO Mock 지갑 주소 → Mill 역할 등록 → 트랜잭션 전송
3. 가공사 A 지갑 주소 → Fabricator 역할 등록 → 트랜잭션 전송
4. 통합사 C 지갑 주소 → Integrator 역할 등록 → 트랜잭션 전송

**검증**: 각 트랜잭션 확인 후 "역할 조회" 탭에서 등록 확인

---

### Scenario 2: MTC 발행

**Actor**: POSCO Mock (Mill 역할)  
**목적**: SS400 강재 H_001 (1000kg) 발행

**단계**:
1. 역할 전환 → Mill 모드 (Admin이 시연하는 경우)
2. `/issue` 페이지
3. 입력:
   - steelId: `H_001`
   - grade: `SS400`
   - weight: `1000` kg
   - C: `0.170`, Si: `0.250`, Mn: `1.200`, P: `0.035`, S: `0.030`
   - 항복강도: `245`, 인장강도: `400`, 연신율: `21`
4. MTC PDF 파일 선택 → IPFS 업로드 → CID 확인
5. "MetaMask로 발행" 클릭 → 트랜잭션 서명

**검증**: `SteelMinted` 이벤트 확인, `/search?id=H_001`에서 조회 가능

---

### Scenario 3: 소유권 이전

**Actor**: POSCO Mock (Mill)  
**목적**: H_001을 가공사 A에게 이전

**단계**:
1. `/transfer` 페이지
2. 강재 선택: H_001
3. 수신자 주소: 가공사 A 지갑 주소 입력
4. "이전" 클릭 → MetaMask 서명

**검증**: `/search?id=H_001` → 소유자 주소가 가공사 A로 변경 확인

---

### Scenario 4: 강재 분할 (정상 케이스)

**Actor**: 가공사 A (Fabricator)  
**목적**: H_001 (1000kg)을 5조각으로 분할 (5% 손실, 950kg 합계)

**단계**:
1. 역할 전환 → Fabricator 모드
2. `/split` 페이지
3. 부모 강재: H_001
4. 자식 무게 입력: `200, 200, 200, 200, 150` (kg) → 합계 950kg
5. 손실률 자동 계산: `(1000-950)/1000 = 5%` → 10% 이하 → 통과 예정
6. "분할" 클릭 → MetaMask 서명

**검증**: 
- H_001 상태 → SPLIT
- H_001_1 ~ H_001_5 생성 확인
- `SteelSplit` 이벤트 확인

---

### Scenario 5: 강재 조합

**Actor**: 가공사 A (Fabricator)  
**목적**: 자식 강재 + HYUNDAI Mock의 다른 강재 → PIPE_001 파이프 생성

**전제**: HYUNDAI Mock 제강사가 OTHER_001 강재를 발행하고 가공사 A에게 이전 완료

**단계**:
1. 역할 전환 → Fabricator 모드
2. `/combine` 페이지
3. 부모 강재 선택: `H_001_1` (200kg) + `OTHER_001` (500kg) = 700kg
4. 자식 강재 ID: `PIPE_001`
5. 자식 무게: `620` kg → 손실률 `(700-620)/700 = 11.4%` → 15% 이하 → 통과
6. 새 MTC PDF 업로드 (파이프 자재증명서)
7. "조합" 클릭 → MetaMask 서명

**검증**: 
- H_001_1, OTHER_001 상태 → COMBINED
- PIPE_001 생성, 두 부모 연결 확인

---

### Scenario 6: 사용 매핑

**Actor**: 통합사 C (Integrator)  
**목적**: PIPE_001을 자동화 설비 부품 P_001에 등록

**전제**: PIPE_001 소유권이 통합사 C에게 이전 완료

**단계**:
1. 역할 전환 → Integrator 모드
2. `/usage` 페이지
3. 강재 선택: PIPE_001
4. 부품 ID: `P_001`
5. 설명: `자동화 설비 A 프레임`
6. "등록" 클릭 → MetaMask 서명

**검증**: `SteelUsed` 이벤트, PIPE_001 상태 → USED

---

### Scenario 7: 전체 이력 조회

**Actor**: 조회자 (누구나)  
**목적**: P_001로 검색하여 PIPE_001의 두 부모 MTC까지 전체 트리 표시

**단계**:
1. `/search` 페이지
2. 부품 ID `P_001` 입력 → 검색
3. 결과: PIPE_001 조회
4. "부모 트리 펼치기" 클릭
5. React Flow 트리 렌더링:
   ```
   [H_001 POSCO] → [H_001_1 가공사A] ─┐
                                        ├→ [PIPE_001] → [P_001]
   [OTHER_001 HYUNDAI] ────────────────┘
   ```
6. H_001 노드 클릭 → 상세 패널 (화학성분, 기계성질, PDF 링크)

---

### Scenario 8: PDF 다운로드 및 해시 검증

**Actor**: 조회자  
**목적**: H_001 MTC PDF 진본성 자동 검증

**단계**:
1. `/search?id=H_001` 페이지
2. "PDF 다운로드 + 검증" 버튼 클릭
3. IPFS에서 PDF 다운로드 (진행 표시바)
4. 브라우저에서 SHA-256 재계산
5. 결과: `검증 완료 ✓ (해시 일치)` 표시

---

### Scenario 9: 사기 시연 A — 무게 부풀리기 거부

**Actor**: 가공사 A  
**목적**: H_001(1000kg)을 1100kg으로 분할 시도

**단계**:
1. `/split` 페이지
2. 부모: H_001 (단, 이 데모에서는 ACTIVE 상태인 다른 강재 사용)
3. 자식 무게: `600, 500` → 합계 1100kg (부모 1000kg 초과)
4. "분할" 클릭

**결과 (UI)**:
- MetaMask에서 트랜잭션 서명 → Sepolia에 전송
- 컨트랙트가 `WEIGHT_EXCEEDS_PARENT` 에러로 revert
- UI 토스트: "거부됨: WEIGHT_EXCEEDS_PARENT — 자식 무게 합계가 부모를 초과합니다"

---

### Scenario 10: 사기 시연 B + C

**Scenario 10-B: 권한 없는 발행 거부**

**단계**:
1. Admin에서 새 지갑 주소 생성 (Mill 역할 없음)
2. 해당 지갑으로 MetaMask 전환
3. `/issue` 페이지에서 MTC 발행 시도

**결과**: `NOT_MILL` 에러로 revert → "Mill 역할이 없습니다" 토스트

---

**Scenario 10-C: 이미 분할된 강재 재분할 거부**

**단계**:
1. Scenario 4에서 SPLIT 처리된 H_001 선택
2. `/split` 페이지에서 H_001 재분할 시도

**결과**: 컨트랙트가 `STEEL_NOT_ACTIVE` 에러로 revert → "이미 분할된 강재입니다" 토스트

---

## 13. 로깅 명세 (SRS)

### 13.1 온체인 이벤트 로그 (Etherscan 조회 가능)

모든 상태 변경 트랜잭션은 블록체인에 영구 기록된다. 이는 별도 로그 시스템 없이 Etherscan Sepolia에서 항상 조회 가능하다.

| 이벤트 | 기록 내용 |
|---|---|
| `SteelMinted` | steelId, 발행자, 무게, IPFS CID, PDF 해시, 타임스탬프 |
| `SteelOwnershipTransferred` | steelId, from, to, 타임스탬프 |
| `SteelSplit` | parentId, childIds[], 무게 배열, 작업자, 타임스탬프 |
| `SteelCombined` | parentIds[], childId, 무게 정보, 작업자, 타임스탬프 |
| `SteelUsed` | steelId, productId, 설명, 통합사, 타임스탬프 |
| `RoleGranted` | role, account, 부여자 |
| `RoleRevoked` | role, account, 해제자 |

### 13.2 프론트엔드 콘솔 로그

개발/시연 환경에서 브라우저 개발자 도구 콘솔에 출력:

```javascript
// 트랜잭션 전송 시
console.log('[MTC] TX Sent:', { function: 'issueMtc', steelId, txHash });

// 트랜잭션 확인 시
console.log('[MTC] TX Confirmed:', { txHash, blockNumber, gasUsed });

// 컨트랙트 에러 시
console.error('[MTC] Contract Error:', { function, reason, data });

// IPFS 업로드 시
console.log('[IPFS] Upload:', { filename, size, cid, sha256 });

// PDF 검증 시
console.log('[PDF] Verify:', { cid, onchainHash, calculatedHash, isValid });

// 이력 조회 시
console.log('[Query] Steel:', { steelId, depth, nodesLoaded });
```

### 13.3 이벤트 로그 UI 패널

화면 하단 고정 패널(접기/펼치기)에 이벤트 피드 표시. 상세 와이어프레임은 §19.1.3 참조.

```
[2026-05-26 14:23:11] ✓ SteelMinted  H_001 | 1000kg | POSCO Mock
[2026-05-26 14:25:03] ✓ SteelOwnershipTransferred  H_001 | POSCO → 가공사A
[2026-05-26 14:26:45] ✓ SteelSplit  H_001 → [H_001_1...H_001_5]
[2026-05-26 14:28:12] ✗ TX Failed  splitSteel | WEIGHT_EXCEEDS_PARENT
```

- 이벤트 소스: `ethers.js`의 `provider.getLogs()` 또는 컨트랙트 `queryFilter()`
- 최신 20개 이벤트 표시
- 각 항목에 Etherscan 트랜잭션 링크

### 13.4 로그가 졸업과제 평가에서 중요한 이유

> 블록체인 이벤트 로그는 단순 로그 기록이 아니라 **시스템의 무결성 증거**다.  
> 모든 이벤트는 변경 불가능하며, 누구나 독립적으로 검증 가능하다.  
> 이 특성이 "단순 DB 대체가 아닌 블록체인의 본질적 활용"을 증명한다.

---

## 14. 보안 요구사항 (SRS)

### 14.1 스마트 컨트랙트 보안

| 위협 | 방어 수단 |
|---|---|
| 권한 없는 MTC 발행 | OpenZeppelin AccessControl + MILL_ROLE 검사 |
| 무게 조작 | 컨트랙트 내부 산술 검증 (uint256 overflow: Solidity 0.8+ 기본 방지) |
| 강재 ID 재사용 | `steelExists[id]` mapping 체크 |
| 타인 소유 강재 조작 | `owner == msg.sender` 검사 |
| 상태 불법 전이 | `status == ACTIVE` 검사 (분할/조합/사용 전) |
| reentrancy | 외부 호출 없음 (순수 상태 변경 함수) |
| Integer Overflow | Solidity ^0.8.0 기본 방지 |

### 14.2 프론트엔드 보안

| 위협 | 방어 수단 |
|---|---|
| IPFS API Key 노출 | 쓰기 전용 제한 키 사용, .gitignore |
| 악의적 PDF 업로드 | 파일 타입 검사 (accept=".pdf"), 크기 제한 (10MB) |
| XSS | React 기본 이스케이프, dangerouslySetInnerHTML 미사용 |
| 잘못된 네트워크 | 네트워크 체크 (Chain ID 11155111 이외 경고) |

### 14.3 졸업과제 범위 외 (명시적 제외)

- 컨트랙트 업그레이드 가능성 (Proxy 패턴) — 범위 외
- 다중 서명 (Multisig) 발행 — 범위 외
- ZK 증명 기반 비공개 데이터 — 범위 외
- 실제 기업 인증 연동 — 범위 외

---

## 15. 테스트 계획 (SRS)

### 15.1 스마트 컨트랙트 단위 테스트 (Hardhat)

```
test/
├── MtcRegistry.access.test.js    # 역할 부여/해제
├── MtcRegistry.issueMtc.test.js  # MTC 발행 (정상/에러)
├── MtcRegistry.transfer.test.js  # 소유권 이전
├── MtcRegistry.split.test.js     # 분할 (정상/무게초과/상태이상)
├── MtcRegistry.combine.test.js   # 조합 (정상/무게초과/단일부모)
├── MtcRegistry.usage.test.js     # 사용 매핑
└── MtcRegistry.query.test.js     # 조회 함수
```

**주요 테스트 케이스**:

| 테스트 ID | 설명 | 기대 결과 |
|---|---|---|
| TC-001 | Admin이 Mill 역할 부여 | RoleGranted 이벤트, hasRole true |
| TC-002 | 비Admin이 역할 부여 시도 | revert |
| TC-003 | Mill이 정상 MTC 발행 | SteelMinted 이벤트, getSteel 성공 |
| TC-004 | 비Mill이 MTC 발행 시도 | revert NOT_MILL |
| TC-005 | 중복 steelId 발행 시도 | revert STEEL_EXISTS |
| TC-006 | 소유권 이전 후 조회 | owner 주소 변경 확인 |
| TC-007 | 10% 이내 손실 분할 | 성공, SteelSplit 이벤트 |
| TC-008 | 무게 부풀리기 분할 시도 | revert WEIGHT_EXCEEDS_PARENT |
| TC-009 | 10% 초과 손실 분할 시도 | revert WEIGHT_LOSS_EXCEEDED |
| TC-010 | SPLIT 상태 강재 재분할 시도 | revert STEEL_NOT_ACTIVE |
| TC-011 | 11개 조각 분할 시도 | revert INVALID_CHILD_COUNT |
| TC-012 | 15% 이내 손실 조합 | 성공, SteelCombined 이벤트 |
| TC-013 | 15% 초과 손실 조합 시도 | revert WEIGHT_LOSS_EXCEEDED |
| TC-014 | 단일 부모 조합 시도 | revert NEED_MULTIPLE_PARENTS |
| TC-015 | 사용 매핑 후 재사용 시도 | revert STEEL_NOT_ACTIVE |
| TC-016 | 부품 ID로 강재 역추적 | getSteelByProduct 성공 |

### 15.2 통합 테스트 (E2E 시나리오)

10개 데모 시나리오 전체를 Hardhat 로컬 네트워크에서 순서대로 실행하는 스크립트:

```
scripts/
└── demo.js   # 10개 시나리오 자동 실행 스크립트
```

### 15.3 프론트엔드 테스트

- MetaMask 지갑 연결 확인
- 역할 전환 후 메뉴 변경 확인
- 트랜잭션 전송 후 UI 업데이트 확인
- PDF 업로드 → IPFS → 해시 검증 E2E 확인

---

## 16. 배포 명세 (SRS)

### 16.1 스마트 컨트랙트 배포

**네트워크**: Ethereum Sepolia Testnet  
**Chain ID**: 11155111  
**Faucet**: https://sepoliafaucet.com  

**Hardhat 배포 스크립트**:
```javascript
// scripts/deploy.js
async function main() {
    const MtcRegistry = await ethers.getContractFactory("MtcRegistry");
    const contract = await MtcRegistry.deploy();
    await contract.waitForDeployment();
    
    console.log("MtcRegistry deployed to:", await contract.getAddress());
    
    // Admin 자신에게 모든 역할 자동 부여
    // (constructor에서 처리)
}
```

**배포 후 작업**:
1. Etherscan Sepolia에서 소스코드 Verify (검증)
2. 배포 주소를 `src/constants/addresses.js`에 저장
3. ABI를 `src/constants/abi.js`에 저장

### 16.2 프론트엔드 배포 (Cloudflare Pages)

**배포 방법**: GitHub 연동 자동 배포

**빌드 설정**:
```
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 20
```

**환경변수 (Cloudflare Pages 설정)**:
```
VITE_CONTRACT_ADDRESS=0x...         # 배포된 컨트랙트 주소
VITE_PINATA_API_KEY=...             # Pinata API Key
VITE_PINATA_API_SECRET=...          # Pinata API Secret
VITE_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
```

**도메인**: Cloudflare Pages 기본 도메인 사용
(`https://mtc-blockchain.pages.dev` 형식)

### 16.3 디렉토리 구조 (전체)

```
MTC_Project/
├── contracts/
│   └── MtcRegistry.sol
├── scripts/
│   ├── deploy.js
│   └── demo.js
├── test/
│   ├── MtcRegistry.access.test.js
│   ├── MtcRegistry.issueMtc.test.js
│   ├── MtcRegistry.split.test.js
│   ├── MtcRegistry.combine.test.js
│   ├── MtcRegistry.usage.test.js
│   └── MtcRegistry.query.test.js
├── worker/                          ← Cloudflare Workers 백엔드 API
│   ├── src/
│   │   └── index.js                 # API 라우터
│   │       # GET  /api/metadata/:steelId
│   │       # POST /api/metadata
│   │       # GET  /api/product/:productId
│   │       # POST /api/product
│   ├── package.json
│   └── wrangler.toml                # KV 바인딩 설정
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   │   ├── ipfs.js
│   │   │   ├── hash.js
│   │   │   ├── format.js
│   │   │   └── api.js               ← Workers API 호출 유틸
│   │   └── constants/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── docs/
│   └── MTC_PRD_SRS.md              ← 현재 문서
├── hardhat.config.js
├── package.json
└── .env.example
```

---

## 17. 일정 계획

> 학부 졸업과제 기준 예상 일정 (1인 기준, 주 5일 풀타임)  
> 세부 Phase별 구현 순서·테스트 계획은 **§20 구현 계획** 참조.

| 주차 | 작업 내용 | 산출물 | §20 Phase |
|---|---|---|---|
| 1주 | 환경 설정, Hardhat/Workers/React 프로젝트 초기화 | hardhat.config.js, wrangler.toml, vite.config.js | Phase 1 |
| 2주 | MtcRegistry.sol — 역할 관리 + MTC 발행 + 소유권 이전 | MtcRegistry.sol (역할·발행·이전) | Phase 2·3 |
| 3주 | MtcRegistry.sol — 분할·조합·사용 매핑·조회 함수 + 단위 테스트 전체 통과 | test/*.test.js (TC-001~016) | Phase 4·5 |
| 4주 | Sepolia 배포 + Etherscan Verify + 데모 스크립트 | 배포 주소, scripts/demo.js | Phase 6 |
| 5주 | Cloudflare Workers 백엔드 API + KV 연동 + 배포 | worker/src/index.js, Workers 배포 URL | Phase 7 |
| 6주 | 프론트엔드 공통 인프라 — 훅·유틸·Header·EventLog·TxStatus | useWallet.js, Header.jsx, EventLog.jsx | Phase 8 |
| 7주 | 역할 관리 UI + MTC 발행 UI (Scenario 1·2 E2E) | RoleManager.jsx, MtcIssuance.jsx | Phase 9 |
| 8주 | 소유권 이전 UI + 강재 분할 UI (Scenario 3·4·9 E2E) | Transfer.jsx, SteelSplit.jsx | Phase 10 |
| 9주 | 강재 조합 UI + 사용 매핑 UI (Scenario 5·6 E2E) | SteelCombine.jsx, SteelUsage.jsx | Phase 11 |
| 10주 | 이력 조회 UI + React Flow 트리 + PDF 검증 (Scenario 7·8 E2E) | AncestryTree.jsx, PdfVerifier.jsx | Phase 12 |
| 11주 | 메인 페이지 + 오류 메시지 한글화 + 전체 10개 Scenario 완성 | Home.jsx, errorMessages.js | Phase 13 |
| 12주 | Cloudflare Pages 배포 + 최종 E2E 테스트 + 버그 수정 | 배포 URL | Phase 14 |
| 13주 | 발표 자료 준비 + 데모 리허설 | 발표 PPT | — |

---

## 18. 용어 정의

| 용어 | 정의 |
|---|---|
| MTC (Mill Test Certificate) | 강재의 화학 성분 및 기계적 성질을 제강사가 공식 보증하는 자재증명서. 한국 현장 용어: "밀시트" |
| 강재 (Steel) | 철강 소재. 본 시스템에서는 동일 Heat Number로 식별되는 강재 로트 단위 |
| Heat Number | 제강사가 생산 로트마다 부여하는 고유 식별번호 (본 시스템의 steelId) |
| IPFS | InterPlanetary File System. 분산 파일 시스템. CID(Content Identifier)로 파일을 식별 |
| CID | IPFS Content Identifier. 파일 내용의 해시 기반 주소. 파일이 변경되면 CID도 변경됨 |
| SHA-256 | 암호학적 해시 함수. PDF 파일의 무결성 검증에 사용 |
| Sepolia | Ethereum 테스트넷. 실제 자산 없이 테스트 가능 |
| Solidity | Ethereum 스마트 컨트랙트 프로그래밍 언어 |
| OpenZeppelin | 검증된 스마트 컨트랙트 라이브러리. AccessControl, Ownable 등 제공 |
| MetaMask | 이더리움 브라우저 지갑 확장 프로그램 |
| Hardhat | Ethereum 스마트 컨트랙트 개발/테스트 프레임워크 |
| Pinata | IPFS 파일 핀닝 서비스. 업로드된 파일이 IPFS 네트워크에 유지되도록 보장 |
| ethers.js | JavaScript Ethereum 라이브러리. 컨트랙트 호출, 지갑 연동에 사용 |
| revert | 스마트 컨트랙트 실행 실패. 상태 변경이 모두 취소되고 에러 메시지 반환 |
| 가스(Gas) | 이더리움 트랜잭션 실행 비용 단위 |
| 온체인(On-chain) | 블록체인에 직접 저장되는 데이터 |
| 오프체인(Off-chain) | 블록체인 외부 (IPFS, 일반 서버)에 저장되는 데이터 |
| 항복강도 (Yield Strength) | 강재가 영구 변형을 시작하는 응력 (MPa) |
| 인장강도 (Tensile Strength) | 강재가 파단되기 직전 최대 응력 (MPa) |
| 연신율 (Elongation) | 파단 시 늘어난 길이 비율 (%) |
| SS400 | 일반 구조용 압연 강재 등급. 인장강도 400~510 MPa |
| SM490 | 용접 구조용 압연 강재. 인장강도 490~610 MPa |

---

## 부록 A: 컨트랙트 가스 비용 추정

| 함수 | 예상 가스 | 개선 전 | 절감 이유 |
|---|---|---|---|
| grantMill | ~50,000 | ~50,000 | 변동 없음 |
| issueMtc | ~120,000 | ~250,000 | grade·화학성분·기계성질 9개 필드 제거 |
| transferOwnership | ~40,000 | ~40,000 | 변동 없음 |
| splitSteel (5조각) | ~400,000 | ~400,000 | 변동 없음 |
| combineSteel (2부모) | ~200,000 | ~300,000 | grade 파라미터 제거 |
| markAsUsed | ~45,000 | ~60,000 | description string 저장 제거 |
| getSteel | 0 (view) | 0 (view) | 가스 없음 |

*Sepolia에서 가스 가격은 무료 Faucet ETH로 충당. 실제 비용 없음.*

---

## 부록 B: 졸업과제 평가 기준별 대응

| 평가 기준 | 대응 내용 |
|---|---|
| 블록체인 기술의 본질적 활용 | - 중앙 관리자 없이 컨트랙트 규칙이 자동 집행 (신뢰 기관 불필요) <br> - 이벤트 로그가 영구 불변 감사 증적 역할 <br> - PDF 해시 검증으로 위조 자동 감지 |
| 컨트랙트 실제 동작 | - Sepolia 배포 주소 제공 <br> - Etherscan Verify로 소스코드 공개 <br> - 10개 시나리오 트랜잭션 해시 실시간 확인 |
| 웹사이트 실제 동작 | - Cloudflare Pages 퍼블릭 URL <br> - MetaMask 연동 실시간 시연 <br> - 트리 시각화, 해시 검증 UI |

---

---

## 19. 화면 설계서

### 19.0 화면 목록 및 접근 권한

| 화면 | 경로 | 접근 가능 역할 |
|---|---|---|
| 메인 | `/` | 누구나 |
| 강재/부품 조회 | `/search` | 누구나 |
| 역할 관리 | `/admin` | Admin |
| MTC 발행 | `/issue` | Mill, Admin |
| 강재 분할 | `/split` | Fabricator, Admin |
| 강재 조합 | `/combine` | Fabricator, Admin |
| 사용 매핑 | `/usage` | Integrator, Admin |
| 소유권 이전 | `/transfer` | Mill, Fabricator, Admin |

---

### 19.1 공통 레이아웃

#### 19.1.1 헤더

모든 페이지 상단 고정.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ⬡ MTC Chain   조회   발행   분할   조합   이전   사용등록   역할관리       │
│                                        [Mill 모드 ▼]  ●Sepolia  0x1234…5678│
└────────────────────────────────────────────────────────────────────────────┘

 MetaMask 미연결 상태:
┌────────────────────────────────────────────────────────────────────────────┐
│  ⬡ MTC Chain   조회   발행   분할   조합   이전   사용등록   역할관리       │
│                                                   ●Sepolia  [지갑 연결 ▶]  │
└────────────────────────────────────────────────────────────────────────────┘

 잘못된 네트워크 접속 시 헤더 직하단 경고 배너:
┌────────────────────────────────────────────────────────────────────────────┐
│  ⚠  현재 네트워크가 Sepolia가 아닙니다. MetaMask에서 Sepolia로 전환하세요. │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 동작 / 조건 |
|---|---|
| 로고 (⬡ MTC Chain) | 클릭 시 `/` 이동 |
| 네비게이션 메뉴 | 현재 역할에서 접근 불가한 항목은 회색 + 클릭 비활성. 현재 페이지는 밑줄 강조 |
| 역할 선택 드롭다운 | Admin 접속 시에만 표시. 옵션: Admin / Mill / Fabricator / Integrator / Auditor |
| 네트워크 뱃지 | Sepolia=초록 점. 그 외=주황 점 + 경고 배너 |
| 지갑 주소 | 클릭 시 전체 주소 클립보드 복사. 미연결 시 [지갑 연결] 버튼으로 대체 |

---

#### 19.1.2 트랜잭션 Toast 알림

화면 우측 하단 고정. 트랜잭션 발생 시 자동 표시, 스택 가능.

```
 ─ 전송 중 ──────────────────────┐     ─ 확인 대기 ──────────────────────┐
  ⏳ 트랜잭션 전송 중...           │     🔄 블록 확인 대기 중...            │
     [Etherscan에서 보기 ↗]        │        TX: 0xab12…ef34               │
 ───────────────────────────────┘        [Etherscan에서 보기 ↗]           │
                                      ──────────────────────────────────┘

 ─ 완료 (초록) ──────────────────┐     ─ 거부됨 (빨강) ─────────────────┐
  ✓ 완료! 블록 #8,234,571 기록   │     ✗ 거부됨                          │
     [Etherscan에서 보기 ↗]        │        WEIGHT_EXCEEDS_PARENT         │
 ───────────────────────────────┘     ──────────────────────────────────┘
```

| 상태 | 색상 | 자동 닫힘 |
|---|---|---|
| 전송 중 | 회색 | 다음 상태로 자동 전환 |
| 확인 대기 | 파랑 | 블록 확인 시 자동 전환 |
| 완료 | 초록 | 5초 후 자동 닫힘 |
| 거부됨 | 빨강 | 수동 닫기 (에러 메시지 확인 목적) |

---

#### 19.1.3 이벤트 로그 패널

화면 하단 접기/펼치기. 기본 상태: 펼침.

```
┌─────────────────────────────────────────────────── [이벤트 로그 ▲] ───────┐
│  [14:28] ✗ splitSteel      WEIGHT_EXCEEDS_PARENT                  [TX ↗]  │
│  [14:26] ✓ SteelSplit      H_001 → [H_001_1…H_001_5]             [TX ↗]  │
│  [14:25] ✓ OwnerTransfer   H_001  POSCO → 가공사A                 [TX ↗]  │
│  [14:23] ✓ SteelMinted     H_001  1,000 kg                         [TX ↗]  │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 동작 |
|---|---|
| 접기/펼치기 버튼 | 패널 높이 토글 |
| 이벤트 행 | 최신 20건 표시, 스크롤 가능. `provider.queryFilter()` 기반 |
| [TX ↗] | Etherscan Sepolia 트랜잭션 페이지 새 탭 |
| ✓ 성공 | 초록 텍스트 |
| ✗ 실패 | 빨강 텍스트 |

---

### 19.2 메인 페이지 (`/`)

접근 권한: 누구나 (지갑 연결 불필요)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ⬡ MTC Chain   조회   발행   분할   조합   이전   사용등록   역할관리       │
│                                        [Mill 모드 ▼]  ●Sepolia  0x1234…5678│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│              ⬡  강재 자재 이력 시스템 (MTC on Blockchain)                 │
│              블록체인 기반 위변조 불가 밀시트 추적 및 진본성 검증            │
│                                                                             │
│    ┌──────────────────────────────────────────────────┐  ┌──────────┐    │
│    │  강재 ID 또는 부품 ID 입력  (예: H_001, P_001)   │  │   검색   │    │
│    └──────────────────────────────────────────────────┘  └──────────┘    │
│                                                                             │
│  ─────────────────────── 역할별 바로가기 ─────────────────────────────── │
│                                                                             │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐ │
│   │  제강사 (Mill)   │   │  가공사 (Fab.)   │   │  통합사 (Integrator) │ │
│   │   MTC 발행 →    │   │  분할 / 조합 →  │   │   사용 등록 →       │ │
│   └──────────────────┘   └──────────────────┘   └──────────────────────┘ │
│                                                                             │
│  ─────────────────────── 최근 온체인 이벤트 ──────────────────────────── │
│   ✓  SteelMinted     H_002  500 kg   POSCO Mock               2분 전      │
│   ✓  SteelSplit      H_001 → [H_001_1…5]  가공사A             5분 전      │
│   ✓  OwnerTransfer   H_001  POSCO → 가공사A                   8분 전      │
│                                                          [전체 보기 →]     │
├────────────────────────────────────────────────────────────────────────────┤
│  [14:23] ✓ SteelMinted  H_001  1,000 kg                          [TX ↗]  │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 타입 | 동작 |
|---|---|---|
| 통합 검색 입력 | text input | Enter 또는 [검색] 클릭 시 `/search?id={값}` 이동 |
| 역할별 바로가기 카드 | 링크 버튼 | 각각 `/issue`, `/split`, `/usage` 이동. 미연결 시 MetaMask 연결 요청 |
| 최근 이벤트 목록 | 읽기 전용 | 컨트랙트 이벤트 최신 5건 자동 로드. [전체 보기] 클릭 시 `/search` 이동 |

---

### 19.3 강재/부품 ID 조회 (`/search`)

접근 권한: 누구나

**[상태 A: 초기 화면]**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header                                                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  강재 / 부품 ID 조회                                                         │
│                                                                             │
│  ┌────────────────────────────────────────────┐  (●) 강재 ID  (○) 부품 ID │
│  │  조회할 ID를 입력하세요  (예: H_001)         │  [      조회      ]        │
│  └────────────────────────────────────────────┘                            │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

**[상태 B: 강재 조회 결과]**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header                                                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │  [ H_001         ]  [조회]   │  │  H_001                   ● SPLIT  │ │
│  │  (●) 강재 ID  (○) 부품 ID   │  ├────────────────────────────────────┤ │
│  └──────────────────────────────┘  │  등급    SS400                     │ │
│                                    │  발행사  POSCO Mock  (0x1234…)    │ │
│                                    │  현소유  가공사A     (0x5678…)    │ │
│                                    │  무게    1,000 kg                  │ │
│                                    │  발행일  2026-05-26 14:23          │ │
│                                    ├────────────────────────────────────┤ │
│                                    │  화학 성분 (%)    ⚠ 서버 데이터   │ │
│                                    │  C 0.170  Si 0.250  Mn 1.200      │ │
│                                    │  P 0.035  S  0.030                │ │
│                                    ├────────────────────────────────────┤ │
│                                    │  기계적 성질      ⚠ 서버 데이터   │ │
│                                    │  항복강도 245 MPa  연신율  21 %   │ │
│                                    │  인장강도 400 MPa                 │ │
│                                    ├────────────────────────────────────┤ │
│                                    │  [PDF 다운로드 + 해시 검증]        │ │
│                                    │  IPFS: Qm3xK…    [IPFS 열기 ↗]  │ │
│                                    └────────────────────────────────────┘ │
│                                                                             │
│  이력 트리                                              [전체화면 ↗]       │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  ┌──────────────────────┐       ┌─────────────────────────┐      │   │
│  │  │  H_001  (SPLIT)      │       │  OTHER_001  (COMBINED)  │      │   │
│  │  │  POSCO · 1,000 kg    │       │  HYUNDAI · 500 kg       │      │   │
│  │  └──────────┬───────────┘       └───────────┬─────────────┘      │   │
│  │             │                               │                     │   │
│  │  ┌──────────▼───────────┐    ┌──────────────▼──────┐             │   │
│  │  │  H_001_1 (COMBINED)  │    │  H_001_2 … H_001_5  │             │   │
│  │  │  가공사A · 200 kg    │    │  (ACTIVE) 각 200 kg │             │   │
│  │  └──────────┬───────────┘    └─────────────────────┘             │   │
│  │             │                                                     │   │
│  │  ┌──────────▼───────────┐                                        │   │
│  │  │  PIPE_001  (USED)    │  ← 클릭 시 좌측 패널 정보 전환        │   │
│  │  │  통합사C · 620 kg    │                                        │   │
│  │  └──────────────────────┘                                        │   │
│  └────────────────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────────────┤
│  이벤트 로그 패널                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

**[PDF 해시 검증 결과 인라인]**

```
  [PDF 다운로드 + 해시 검증]  클릭 후:
  다운로드 중... ████████████░░░  80%

  ✓ 검증 완료   온체인: 0xabc1…ef   계산값: 0xabc1…ef   [일치]

  ✗ 위조 의심   온체인: 0xabc1…ef   계산값: 0xdef2…12   [불일치 — 경고!]
```

| 요소 | 타입 | 동작 |
|---|---|---|
| 검색 입력 | text input | Enter / [조회] 클릭 시 결과 표시. URL에 `?id=` 반영 (북마크·공유 가능) |
| 조회 유형 | radio | "강재 ID": 직접 조회. "부품 ID": `productMap`으로 해당 강재 자동 조회 |
| 강재 상태 뱃지 | 읽기 전용 | ACTIVE=초록, SPLIT=노랑, COMBINED=주황, USED=회색 |
| 화학성분·기계적성질 | 읽기 전용 | 서버(KV) 조회. "⚠ 서버 데이터 (참고용)" 주석 병기 |
| PDF 다운로드 + 해시 검증 | 버튼 | IPFS 다운로드 → SHA-256 재계산 → 온체인 pdfHash 비교 후 결과 인라인 표시 |
| IPFS 열기 | 링크 | `{IPFS_GATEWAY}/{CID}` 새 탭 |
| 이력 트리 (React Flow) | 인터랙티브 | 노드 클릭: 좌측 상세 패널 갱신. 휠 줌, 드래그 이동 지원 |
| 트리 노드 색상 | 시각 | 상태별 테두리: ACTIVE=초록, SPLIT=노랑, COMBINED=주황, USED=회색 |

---

### 19.4 역할 관리 (`/admin`)

접근 권한: Admin

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header  (역할: Admin)                                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  역할 관리                                  [역할 등록]  [역할 조회]  탭    │
│                                                                             │
│  ┌─ 역할 등록 ──────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  지갑 주소    [ 0x...                                      ]         │  │
│  │                                                                      │  │
│  │  역할 선택    (○) Mill (제강사)                                       │  │
│  │               (●) Fabricator (가공사)                                │  │
│  │               (○) Integrator (통합사)                                │  │
│  │                                                                      │  │
│  │                                       [역할 등록 — MetaMask ✍]      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ 등록된 역할 목록 ────────────────────────────────────────────────────┐  │
│  │  주소                역할               등록일           액션         │  │
│  │  0x1234…5678        Mill (제강사)      2026-05-26       [해제]       │  │
│  │  0x5678…1234        Fabricator (가공사) 2026-05-26      [해제]       │  │
│  │  0xabcd…efgh        Integrator (통합사) 2026-05-26      [해제]       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  이벤트 로그 패널                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 타입 | 동작 / 검증 |
|---|---|---|
| 지갑 주소 입력 | text input | 0x 시작 42자 형식 검증. 형식 불일치 시 인라인 에러 표시 |
| 역할 선택 | radio | Mill / Fabricator / Integrator 중 택 1 |
| 역할 등록 버튼 | 버튼 | MetaMask 서명 후 `grantMill/Fabricator/Integrator` 호출. 중복은 컨트랙트가 무시(idempotent) |
| 등록된 역할 목록 | 읽기 전용 | `RoleGranted` 이벤트 조회. 페이지 진입 시 자동 로드 |
| [해제] 버튼 | 버튼 | 확인 모달("역할을 해제하시겠습니까?") 후 `revoke*` 트랜잭션 전송 |

---

### 19.5 MTC 발행 (`/issue`)

접근 권한: Mill, Admin

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header  (역할: Mill)                                                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MTC 발행                                                                   │
│                                                                             │
│  ┌─ ① 강재 기본 정보 (블록체인 저장) ───────────────────────────────────┐  │
│  │  강재 ID (Heat No.)   [ H_001                         ]             │  │
│  │  강재 등급            [SS400           ▼]  또는  [직접 입력   ]      │  │
│  │  무게                 [         1000.0          ] kg                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ ② 화학 성분 (%) ─────────────── ※ 서버(KV) 저장 / 진본증명: PDF 해시 │
│  │  C [0.170]   Si [0.250]   Mn [1.200]   P [0.035]   S [0.030]        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ ③ 기계적 성질 ──────────────── ※ 서버(KV) 저장 / 진본증명: PDF 해시  │
│  │  항복강도 [ 245 ] MPa     인장강도 [ 400 ] MPa     연신율 [ 21 ] %   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ ④ MTC PDF 업로드 (블록체인 해시 저장) ──────────────────────────────┐  │
│  │  [ PDF 파일 선택 (.pdf, 최대 10MB) ]                                 │  │
│  │                                                                      │  │
│  │  업로드 진행:  ████████████░░░  75%  IPFS 업로드 중...              │  │
│  │  IPFS CID:    Qm3xKv…vP7  [복사]  [미리보기 ↗]                    │  │
│  │  SHA-256:     0xabc1…2345  [복사]                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [초기화]                                     [MetaMask로 발행 ✍]          │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  이벤트 로그 패널                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 타입 | 동작 / 검증 |
|---|---|---|
| 강재 ID | text input | 영문·숫자·언더스코어. 중복은 컨트랙트 최종 검증 |
| 강재 등급 | select + text | 드롭다운(SS400, SM490, SMA490W, A36, S355) 또는 직접 입력. 서버(KV) 저장 |
| 무게 | number input | 소수점 1자리, 0 불가. 내부적으로 g 단위 변환 후 컨트랙트 전송 |
| 화학성분 5개 | number input | 소수점 3자리. 서버(KV) 저장 (블록체인 미기록) |
| 기계적성질 3개 | number input | 정수. 서버(KV) 저장 (블록체인 미기록) |
| PDF 파일 선택 | file input | .pdf 한정, 10MB 제한. 선택 즉시 SHA-256 계산 시작 |
| IPFS 업로드 | 자동 | PDF 선택 후 Pinata API 호출. 완료 시 CID·해시 자동 표시 |
| MetaMask로 발행 | 버튼 | ①~④ 모두 완료 시 활성화. 클릭 순서: ① 컨트랙트 트랜잭션 → ② 트랜잭션 확인 후 서버 메타데이터 저장 |
| 초기화 | 버튼 | 확인 모달 후 폼 전체 초기화 |

---

### 19.6 강재 분할 (`/split`)

접근 권한: Fabricator, Admin

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header  (역할: Fabricator)                                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  강재 분할  (1 → N)                                                          │
│                                                                             │
│  ┌─ 부모 강재 선택 ─────────────────────────────────────────────────────┐  │
│  │  강재 ID   [ H_003                    ]  [조회]                      │  │
│  │  ✓  H_003  SS490  2,000 kg  소유자: 본인  상태: ACTIVE              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ 자식 무게 입력 (최소 2개 / 최대 10개) ──────────────────────────────┐  │
│  │                                                                      │  │
│  │  자식 1:  [  500.0  ] kg       자식 2:  [  500.0  ] kg              │  │
│  │  자식 3:  [  400.0  ] kg       자식 4:  [  400.0  ] kg              │  │
│  │                                                  [+ 행 추가]         │  │
│  │                                                  [- 마지막 제거]     │  │
│  │                                                                      │  │
│  │  ┌─ 무게 검증 ──────────────────────────────────────────────────┐  │  │
│  │  │  부모 무게:    2,000 kg                                      │  │  │
│  │  │  자식 합계:    1,800 kg   (90.0%)   ✓ 허용 범위 내 (≤ 10%)  │  │  │
│  │  │  ████████████████████░░  90%                                 │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [초기화]                                     [MetaMask로 분할 ✍]          │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  이벤트 로그 패널                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

**무게 검증 상태별 표시**

```
  ✓ 허용 범위 내   자식 합계: 1,800 kg  손실: 10.0%  (≤ 10%)  → 초록
  ✗ 손실 초과      자식 합계: 1,700 kg  손실: 15.0%  (> 10%)  → 빨강, 버튼 비활성
  ✗ 무게 초과      자식 합계: 2,100 kg  (부모 2,000 kg 초과)   → 빨강, 버튼 비활성
```

| 요소 | 타입 | 동작 / 검증 |
|---|---|---|
| 강재 ID + [조회] | text input + 버튼 | 본인 소유·ACTIVE 확인. 미충족 시 인라인 에러 |
| 자식 무게 입력 배열 | number input 배열 | [+ 행 추가]: 최대 10개. [- 마지막 제거]: 최소 2개 유지 |
| 무게 검증 프리뷰 | 실시간 계산 | 입력 변경 시 즉시 갱신. 허용 범위 초과 시 빨강 + [분할] 버튼 비활성 |
| MetaMask로 분할 | 버튼 | 무게 검증 통과 시만 활성화. 컨트랙트가 최종 검증 수행 |

---

### 19.7 강재 조합 (`/combine`)

접근 권한: Fabricator, Admin

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header  (역할: Fabricator)                                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  강재 조합  (N → 1)                                                          │
│                                                                             │
│  ┌─ 부모 강재 선택 (2개 이상) ──────────────────────────────────────────┐  │
│  │  [+ 강재 추가]                                                       │  │
│  │                                                                      │  │
│  │  ✓  H_001_1    SS400   200 kg  소유자: 본인  ACTIVE   [✕ 제거]     │  │
│  │  ✓  OTHER_001  SM490   500 kg  소유자: 본인  ACTIVE   [✕ 제거]     │  │
│  │                                                                      │  │
│  │  부모 합계: 700 kg                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ 결과물 강재 정보 ────────────────────────────────────────────────────┐  │
│  │  강재 ID     [ PIPE_001                        ]                     │  │
│  │  강재 등급   [SM490 ▼]  또는  [직접 입력  ]   (서버 저장)            │  │
│  │  무게        [       620.0       ] kg                                 │  │
│  │                                                                      │  │
│  │  ┌─ 무게 검증 ────────────────────────────────────────────────┐    │  │
│  │  │  부모 합계: 700 kg   자식: 620 kg   손실: 11.4%  ✓ 통과   │    │  │
│  │  │  ██████████████████░░░  88.6%                               │    │  │
│  │  └────────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ 새 MTC PDF 업로드 (결과물 자재증명서) ──────────────────────────────┐  │
│  │  [ PDF 파일 선택 (.pdf) ]                                            │  │
│  │  CID: Qm…  SHA-256: 0x…                                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [초기화]                                     [MetaMask로 조합 ✍]          │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  이벤트 로그 패널                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 타입 | 동작 / 검증 |
|---|---|---|
| [+ 강재 추가] | 버튼 | 인라인 강재 ID 입력 필드 표시 → 조회 → 본인 소유·ACTIVE 확인 후 목록 추가 |
| 부모 강재 목록 | 동적 리스트 | [✕ 제거] 클릭 시 목록에서 삭제. 최소 2개 미만이면 [조합] 버튼 비활성 |
| 결과물 강재 ID | text input | 기존 ID 중복 불가. 컨트랙트 최종 검증 |
| 결과물 등급 | select + text | 서버(KV) 저장 |
| 결과물 무게 | number input | 무게 검증 프리뷰 실시간 갱신 (허용 손실 ≤ 15%) |
| 새 MTC PDF | file input | 조합 결과물용 밀시트. IPFS 업로드 완료 시만 [조합] 버튼 활성 |
| MetaMask로 조합 | 버튼 | 부모 2개↑ + 무게 검증 통과 + PDF 업로드 완료 시 활성화 |

---

### 19.8 사용 매핑 (`/usage`)

접근 권한: Integrator, Admin

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header  (역할: Integrator)                                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  사용 매핑  (강재 → 부품 등록)                                               │
│                                                                             │
│  ┌─ 사용할 강재 선택 ────────────────────────────────────────────────────┐  │
│  │  강재 ID   [ PIPE_001             ]  [조회]                          │  │
│  │  ✓  PIPE_001  SM490  620 kg  소유자: 본인  상태: ACTIVE             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ 부품 정보 입력 ──────────────────────────────────────────────────────┐  │
│  │  부품 ID     [ P_001                               ]  (블록체인)      │  │
│  │  부품 설명   [ 자동화 설비 A 프레임                ]  (서버 저장)     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ⚠  등록 완료 후 해당 강재의 상태는 USED로 변경됩니다.                      │
│     이 작업은 되돌릴 수 없습니다.                                           │
│                                                                             │
│  [초기화]                                  [MetaMask로 사용 등록 ✍]       │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  이벤트 로그 패널                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 타입 | 동작 / 검증 |
|---|---|---|
| 강재 ID + [조회] | text input + 버튼 | 본인 소유·ACTIVE 확인. 미충족 시 인라인 에러 |
| 부품 ID | text input | 영문·숫자·언더스코어. 컨트랙트 `productMap`에 저장 |
| 부품 설명 | text input | 서버(KV `product:{productId}`) 저장 |
| MetaMask로 사용 등록 | 버튼 | 클릭 순서: ① `markAsUsed` 트랜잭션 → ② 트랜잭션 확인 후 서버 부품 설명 저장 |
| 불가역 경고 | 읽기 전용 | USED 전환 후 해당 강재 재사용 불가 안내. 주황 배경 강조 |

---

### 19.9 소유권 이전 (`/transfer`)

접근 권한: Mill, Fabricator, Admin

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Header  (역할: Mill)                                                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  소유권 이전                                                                 │
│                                                                             │
│  ┌─ 이전할 강재 선택 ────────────────────────────────────────────────────┐  │
│  │  강재 ID   [ H_001              ]  [조회]                            │  │
│  │  ✓  H_001  SS400  1,000 kg  소유자: 본인  상태: ACTIVE              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ 수신자 정보 ─────────────────────────────────────────────────────────┐  │
│  │  수신자 주소    [ 0x5678...abcd                         ]  [확인]    │  │
│  │                                                                      │  │
│  │  ✓  0x5678…abcd    역할: Fabricator    시스템 등록 주소 ✓           │  │
│  │                                                                      │  │
│  │  ✗  0x9999…1111    시스템에 등록되지 않은 주소                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ⚠  이전 완료 후 해당 강재에 대한 모든 권한이 수신자에게 이동됩니다.        │
│                                                                             │
│  [초기화]                                     [MetaMask로 이전 ✍]          │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│  이벤트 로그 패널                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

| 요소 | 타입 | 동작 / 검증 |
|---|---|---|
| 강재 ID + [조회] | text input + 버튼 | 본인 소유·ACTIVE 확인 |
| 수신자 주소 + [확인] | text input + 버튼 | 42자 형식 검증 후 컨트랙트로 Fabricator·Integrator 역할 조회 |
| 수신자 역할 표시 | 읽기 전용 | 확인 완료 시 역할 자동 표시. 미등록 주소면 경고 텍스트 + [이전] 버튼 비활성 |
| MetaMask로 이전 | 버튼 | 강재 확인 + 수신자 확인 완료 시 활성화 |
| 불가역 경고 | 읽기 전용 | 이전 후 권한 상실 안내. 주황 배경 강조 |

---

---

## 20. 구현 계획

> **전제 조건**  
> - 개발자: 1인  
> - 단위: 1 Phase = 약 1 man-day (8시간)  
> - 각 Phase는 **구현 → 코드 리뷰 → 검증 → 단위/기능 테스트 → 사이드 이펙트 검증 → 이전 전체 Phase 회귀 테스트** 순으로 진행  
> - 스마트 컨트랙트가 백엔드보다, 백엔드가 프론트엔드보다 먼저 구현된다 (의존성 순서 준수)  
> - Sepolia ETH Faucet 수령, Pinata 계정 생성, Cloudflare 계정 생성은 Phase 1 착수 전 사전 완료

---

### Phase 1 — 개발 환경 세팅 및 프로젝트 초기화

**목표**: 세 레이어(컨트랙트 / 백엔드 / 프론트엔드) 개발 환경을 한 번에 구성하고, 각 레이어가 독립적으로 기동됨을 확인한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 1-1 | Hardhat 프로젝트 초기화, OpenZeppelin ^5 설치 | `hardhat.config.js`, `package.json` |
| 1-2 | 디렉토리 구조 생성 (`contracts/`, `scripts/`, `test/`, `worker/`, `frontend/`, `docs/`) | 폴더 트리 |
| 1-3 | Cloudflare Workers 프로젝트 초기화 (`wrangler init`) | `worker/wrangler.toml`, `worker/src/index.js` (Hello World) |
| 1-4 | React + Vite 프론트엔드 초기화, Tailwind CSS + React Router + ethers.js + React Flow 설치 | `frontend/package.json`, `frontend/vite.config.js` |
| 1-5 | 빈 라우팅 구조 (`App.jsx` + 8개 빈 페이지 컴포넌트) | `src/App.jsx` |
| 1-6 | `.env.example` 작성 (필요한 환경변수 전체 목록) | `.env.example` |
| 1-7 | `hardhat.config.js`에 Sepolia 네트워크 및 Etherscan API 키 설정 | 설정 완료 |

#### 코드 리뷰 체크리스트

- [ ] 패키지 버전 충돌 없음 (`npm ls` 경고 없음)
- [ ] `.gitignore`에 `.env`, `node_modules`, `dist`, `artifacts`, `cache` 포함
- [ ] `wrangler.toml` 계정 ID 및 KV 네임스페이스 플레이스홀더 명시

#### 검증 및 테스트

- `npx hardhat compile` → 에러 없음
- `cd worker && npx wrangler dev` → Hello World 응답 확인
- `cd frontend && npm run dev` → 브라우저에서 빈 라우팅 페이지 로드 확인

#### 사이드 이펙트 검증

- 없음 (첫 Phase)

#### 이전 Phase 회귀 테스트

- 없음 (첫 Phase)

---

### Phase 2 — 스마트 컨트랙트: 역할 관리

**목표**: AccessControl 기반 역할 등록·해제 함수를 구현하고, 권한 검사가 정확히 동작함을 단위 테스트로 증명한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 2-1 | `MtcRegistry.sol` 기본 골격 (`AccessControl` 상속, 역할 상수 3개 정의) | `contracts/MtcRegistry.sol` |
| 2-2 | `grantMill`, `grantFabricator`, `grantIntegrator` (onlyRole(DEFAULT_ADMIN_ROLE)) | 함수 구현 |
| 2-3 | `revokeMill`, `revokeFabricator`, `revokeIntegrator` | 함수 구현 |
| 2-4 | `hasMillRole`, `hasFabricatorRole`, `hasIntegratorRole` (view) | 함수 구현 |
| 2-5 | `RoleGranted` / `RoleRevoked` 이벤트 (OpenZeppelin 기본 이벤트 사용) | 이벤트 확인 |
| 2-6 | 단위 테스트 작성 (`test/MtcRegistry.access.test.js`) | 테스트 파일 |

#### 코드 리뷰 체크리스트

- [ ] `DEFAULT_ADMIN_ROLE`이 컨트랙트 배포자에게만 자동 부여됨 (`constructor`)
- [ ] `onlyRole` 수정자가 모든 grant/revoke 함수에 적용됨
- [ ] 중복 역할 부여 시 revert 없이 무시(idempotent) 동작 확인

#### 검증 및 테스트

| 테스트 케이스 | 기대 결과 |
|---|---|
| TC-001: Admin이 Mill 역할 부여 | `RoleGranted` 이벤트, `hasMillRole` → true |
| TC-002: 비Admin이 역할 부여 시도 | revert (`AccessControl` 기본 에러) |
| TC-추가: Admin이 부여한 역할 해제 | `hasMillRole` → false |
| TC-추가: 중복 역할 부여 | revert 없음, 상태 변화 없음 |

- `npx hardhat test test/MtcRegistry.access.test.js` → 전체 통과

#### 사이드 이펙트 검증

- `npx hardhat compile` 에러 없음

#### 이전 Phase 회귀 테스트

- Phase 1: `npm run dev` (프론트엔드) 기동 확인

---

### Phase 3 — 스마트 컨트랙트: MTC 발행 + 소유권 이전

**목표**: 강재 최초 등록(`issueMtc`)과 소유권 이전(`transferOwnership`)을 구현하고, 핵심 비즈니스 규칙이 컨트랙트 수준에서 강제됨을 테스트한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 3-1 | `SteelStatus` 열거형 정의 (`ACTIVE`, `SPLIT`, `COMBINED`, `USED`) | 열거형 |
| 3-2 | `Steel` 구조체 정의 (§8.3 명세 기준) | 구조체 |
| 3-3 | `mapping(string => Steel) steels`, `mapping(string => bool) steelExists` | 매핑 |
| 3-4 | `issueMtc(steelId, weight, ipfsCid, pdfHash)` + Custom Error 정의 | 함수 + 에러 |
| 3-5 | `SteelMinted` 이벤트 정의 및 emit | 이벤트 |
| 3-6 | `transferOwnership(steelId, to)` — 소유자·상태·수신자 역할 검증 포함 | 함수 |
| 3-7 | `SteelOwnershipTransferred` 이벤트 정의 및 emit | 이벤트 |
| 3-8 | 단위 테스트 (`test/MtcRegistry.issueMtc.test.js`, `test/MtcRegistry.transfer.test.js`) | 테스트 파일 |

#### 코드 리뷰 체크리스트

- [ ] `weight`는 g 단위 `uint256`이고, 0 불가 조건 적용
- [ ] `pdfHash != bytes32(0)` 조건 적용
- [ ] `transferOwnership` 수신자가 `FABRICATOR_ROLE` 또는 `INTEGRATOR_ROLE` 또는 `DEFAULT_ADMIN_ROLE` 보유 여부 검증
- [ ] 발행 시 `owner = msg.sender`, `mill = msg.sender` 설정

#### 검증 및 테스트

| 테스트 케이스 | 기대 결과 |
|---|---|
| TC-003: Mill이 정상 MTC 발행 | `SteelMinted` 이벤트, `getSteel` 조회 성공 |
| TC-004: 비Mill이 MTC 발행 시도 | revert `NotMill` |
| TC-005: 중복 steelId 발행 시도 | revert `SteelExists` |
| TC-006: 소유권 이전 후 owner 조회 | owner 주소 변경 확인 |
| TC-추가: weight=0 발행 시도 | revert |
| TC-추가: pdfHash=0 발행 시도 | revert |
| TC-추가: 비소유자가 이전 시도 | revert `NotOwner` |
| TC-추가: 미등록 수신자에게 이전 시도 | revert `InvalidRecipient` |

- `npx hardhat test test/MtcRegistry.issueMtc.test.js test/MtcRegistry.transfer.test.js` → 전체 통과

#### 사이드 이펙트 검증

- `npx hardhat test test/MtcRegistry.access.test.js` → Phase 2 테스트 유지

#### 이전 Phase 회귀 테스트

- Phase 2 전체 테스트 통과 확인

---

### Phase 4 — 스마트 컨트랙트: 강재 분할 (splitSteel)

**목표**: 1:N 분할 로직과 무게 보존 법칙(최대 10% 손실)을 구현하고, 경계값을 포함한 모든 에러 케이스가 거부됨을 검증한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 4-1 | `splitSteel(parentId, childWeights[])` 함수 구현 | 함수 |
| 4-2 | 자식 강재 ID 자동 생성 로직 (`{parentId}_{순번}`, 1-indexed) | ID 생성 로직 |
| 4-3 | 무게 보존 검증: `sum ≤ parent.weight` AND `sum ≥ parent.weight * 90 / 100` | 검증 로직 |
| 4-4 | 부모 상태 → `SPLIT`, 자식 강재 생성 (각 `ACTIVE`, `owner = msg.sender`) | 상태 전이 |
| 4-5 | 부모-자식 `parentIds` / `childIds` 연결 | 트리 연결 |
| 4-6 | `SteelSplit` 이벤트 정의 및 emit | 이벤트 |
| 4-7 | 단위 테스트 (`test/MtcRegistry.split.test.js`) | 테스트 파일 |

#### 코드 리뷰 체크리스트

- [ ] 자식 개수 범위: 2 ≤ N ≤ 10 강제
- [ ] 자식 무게 중 0인 항목 있을 시 revert
- [ ] 부모 상태가 `ACTIVE`가 아니면 revert
- [ ] 부모 소유자가 `msg.sender`가 아니면 revert
- [ ] 자식 강재 ID가 기존 steelId와 중복되지 않음 (생성 전 `steelExists` 체크)

#### 검증 및 테스트

| 테스트 케이스 | 기대 결과 |
|---|---|
| TC-007: 10% 이내 손실 분할 (5조각) | 성공, `SteelSplit` 이벤트, 자식 5개 생성 |
| TC-008: 무게 부풀리기 시도 (sum > parent) | revert `WeightExceedsParent` |
| TC-009: 10% 초과 손실 분할 시도 | revert `WeightLossExceeded` |
| TC-010: SPLIT 상태 강재 재분할 시도 | revert `SteelNotActive` |
| TC-011: 11개 조각 분할 시도 | revert `InvalidChildCount` |
| TC-추가: 자식 무게 중 0 포함 | revert |
| TC-추가: 비소유자 분할 시도 | revert `NotOwner` |

- `npx hardhat test test/MtcRegistry.split.test.js` → 전체 통과

#### 사이드 이펙트 검증

- 분할 후 부모 강재 `steelId`로 재발행 시도 → `SteelExists` revert 확인

#### 이전 Phase 회귀 테스트

- `npx hardhat test test/MtcRegistry.access.test.js test/MtcRegistry.issueMtc.test.js test/MtcRegistry.transfer.test.js` → 전체 통과

---

### Phase 5 — 스마트 컨트랙트: 강재 조합 + 사용 매핑 + 조회 함수

**목표**: 나머지 상태 변경 함수(combineSteel, markAsUsed)와 모든 view 함수를 완성하여 컨트랙트 기능을 완전히 구현한다. 전체 16개 테스트 케이스를 통과시킨다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 5-1 | `combineSteel(parentIds[], childId, childWeight, ipfsCid, pdfHash)` 함수 구현 | 함수 |
| 5-2 | 조합 무게 보존 검증: `childWeight ≤ sum` AND `childWeight ≥ sum * 85 / 100` | 검증 로직 |
| 5-3 | 부모 강재들 상태 → `COMBINED`, 자식 강재 생성 (`ACTIVE`) | 상태 전이 |
| 5-4 | `SteelCombined` 이벤트 정의 및 emit | 이벤트 |
| 5-5 | `mapping(string => string) productMap` + `markAsUsed(steelId, productId)` | 함수 |
| 5-6 | `SteelUsed` 이벤트 정의 및 emit | 이벤트 |
| 5-7 | `getSteel`, `getParents`, `getChildren`, `getSteelByProduct` view 함수 | 조회 함수 4개 |
| 5-8 | 단위 테스트 (`test/MtcRegistry.combine.test.js`, `test/MtcRegistry.usage.test.js`, `test/MtcRegistry.query.test.js`) | 테스트 파일 3개 |

#### 코드 리뷰 체크리스트

- [ ] `combineSteel` 부모 2개 미만 시 revert `NeedMultipleParents`
- [ ] `combineSteel` 부모 중 `ACTIVE` 아닌 강재 있으면 revert
- [ ] `combineSteel` 부모 중 소유자 아닌 강재 있으면 revert
- [ ] `markAsUsed` 후 강재 상태 `USED` 전환, 재사용 불가 확인
- [ ] `getSteelByProduct`가 `productId` → `steelId` 정확히 반환

#### 검증 및 테스트

| 테스트 케이스 | 기대 결과 |
|---|---|
| TC-012: 15% 이내 손실 조합 | 성공, `SteelCombined` 이벤트 |
| TC-013: 15% 초과 손실 조합 시도 | revert `WeightLossExceeded` |
| TC-014: 단일 부모 조합 시도 | revert `NeedMultipleParents` |
| TC-015: 사용 매핑 후 재사용 시도 | revert `SteelNotActive` |
| TC-016: 부품 ID로 강재 역추적 | `getSteelByProduct` 성공 |
| TC-추가: 조합 후 부모 강재 재분할 시도 | revert `SteelNotActive` |

#### 사이드 이펙트 검증

- 전체 `Steel` 상태 전이 흐름 최종 확인:  
  `ACTIVE → SPLIT`, `ACTIVE → COMBINED`, `ACTIVE → USED` (각각 단방향, 되돌릴 수 없음)

#### 이전 Phase 회귀 테스트

- `npx hardhat test` (전체 테스트 수트 TC-001~TC-016) → **전체 통과**

---

### Phase 6 — 스마트 컨트랙트: Sepolia 배포 + 검증 + 데모 스크립트

**목표**: 컨트랙트를 Sepolia 테스트넷에 배포하고 Etherscan에서 소스코드를 공개한다. 10개 시나리오 자동 실행 스크립트로 실제 네트워크 동작을 검증한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 6-1 | `scripts/deploy.js` 작성 (배포 + Admin 역할 자동 부여 확인) | `scripts/deploy.js` |
| 6-2 | Sepolia 배포 실행 → 컨트랙트 주소 기록 | 배포 주소 |
| 6-3 | Etherscan Sepolia 소스코드 Verify (`npx hardhat verify`) | Etherscan 검증 URL |
| 6-4 | `frontend/src/constants/abi.js` ABI 저장 | `abi.js` |
| 6-5 | `frontend/src/constants/addresses.js` 배포 주소 저장 | `addresses.js` |
| 6-6 | `scripts/demo.js` 작성 — Hardhat 로컬 노드 기반 10개 시나리오 자동 순차 실행 | `scripts/demo.js` |
| 6-7 | `npx hardhat run scripts/demo.js --network localhost` 실행 | 콘솔 출력 |

#### 코드 리뷰 체크리스트

- [ ] Etherscan에서 소스코드 Verified 뱃지 확인
- [ ] ABI 파일에 모든 함수·이벤트·에러 포함
- [ ] `demo.js`가 각 시나리오 결과(성공/거부)를 콘솔에 명확히 출력

#### 검증 및 테스트

- Etherscan Sepolia에서 컨트랙트 주소 접속 → "Contract" 탭에서 Verified 소스코드 확인
- `demo.js` 실행 결과: Scenario 1~8 성공, Scenario 9·10 revert 확인
- `getSteel("H_001")` Sepolia에서 직접 호출 → 발행 데이터 일치

#### 사이드 이펙트 검증

- Sepolia 배포 주소가 `addresses.js`에 정확히 저장되었는지 확인

#### 이전 Phase 회귀 테스트

- `npx hardhat test` (전체) → 전체 통과

---

### Phase 7 — Cloudflare Workers 백엔드 API

**목표**: 메타데이터(등급, 화학성분, 기계적성질, 부품설명)를 KV에 저장·조회하는 서버리스 API를 구현하고 배포한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 7-1 | `worker/src/index.js` 라우터 구현 (URL 패턴 매칭) | `index.js` |
| 7-2 | `GET /api/metadata/:steelId` — KV 조회, 404 처리 | 엔드포인트 |
| 7-3 | `POST /api/metadata` — `X-Api-Key` 헤더 인증, KV 저장, 409 중복 방지 | 엔드포인트 |
| 7-4 | `GET /api/product/:productId` — KV 조회, 404 처리 | 엔드포인트 |
| 7-5 | `POST /api/product` — `X-Api-Key` 헤더 인증, KV 저장 | 엔드포인트 |
| 7-6 | CORS 헤더 설정 (Cloudflare Pages 도메인 허용) | 미들웨어 |
| 7-7 | `wrangler.toml` KV 네임스페이스 바인딩 (`MTC_METADATA`) | 설정 |
| 7-8 | Cloudflare Workers 배포 (`wrangler deploy`) | 배포 URL |

#### 코드 리뷰 체크리스트

- [ ] `X-Api-Key` 미제공 시 POST 엔드포인트가 401 반환
- [ ] KV key 형식: 강재 메타데이터 `steel:{steelId}`, 부품 설명 `product:{productId}`
- [ ] 모든 응답 `Content-Type: application/json`
- [ ] CORS preflight `OPTIONS` 요청 처리

#### 검증 및 테스트

```
# POST 테스트
curl -X POST https://{workers-url}/api/metadata \
  -H "X-Api-Key: {key}" -H "Content-Type: application/json" \
  -d '{"steelId":"H_001","grade":"SS400","chemC":0.17,...}'
→ {"ok": true}

# GET 테스트
curl https://{workers-url}/api/metadata/H_001
→ {"grade":"SS400","chemC":0.17,...}

# 인증 없는 POST
curl -X POST https://{workers-url}/api/metadata -d '{}'
→ 401 Unauthorized
```

#### 사이드 이펙트 검증

- Workers 배포 후 기존 컨트랙트 ABI/주소 변경 없음 확인

#### 이전 Phase 회귀 테스트

- `npx hardhat test` 전체 통과
- `demo.js` Scenario 1~10 재실행 확인

---

### Phase 8 — 프론트엔드: 공통 인프라 + 헤더 + 공통 컴포넌트

**목표**: 모든 페이지가 공유하는 유틸리티, 훅, 공통 UI 컴포넌트를 완성한다. MetaMask 연결이 실제 Sepolia 환경에서 동작함을 확인한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 8-1 | `utils/hash.js` — `crypto.subtle` 기반 SHA-256 계산 | `hash.js` |
| 8-2 | `utils/ipfs.js` — Pinata API 업로드 (`uploadPdfToIpfs`) | `ipfs.js` |
| 8-3 | `utils/format.js` — g ↔ kg 변환, 주소 단축 표시 | `format.js` |
| 8-4 | `utils/api.js` — Workers API 호출 (`getSteelMeta`, `saveSteelMeta`, `saveProductDesc`) | `api.js` |
| 8-5 | `hooks/useWallet.js` — MetaMask 연결, 주소·네트워크 상태, Chain ID 감시 | `useWallet.js` |
| 8-6 | `hooks/useContract.js` — ethers.js 컨트랙트 인스턴스 (읽기/쓰기) | `useContract.js` |
| 8-7 | `hooks/useRole.js` — 현재 지갑의 역할 조회 및 Admin 모드 선택 역할 상태 | `useRole.js` |
| 8-8 | `components/layout/Header.jsx` — 로고, 네비게이션, 역할 배지, 네트워크 뱃지, 지갑 연결 버튼 | `Header.jsx` |
| 8-9 | `components/layout/RoleSwitcher.jsx` — Admin 전용 역할 드롭다운 | `RoleSwitcher.jsx` |
| 8-10 | `components/common/TxStatus.jsx` — Toast 알림 (전송중/대기중/완료/거부됨) | `TxStatus.jsx` |
| 8-11 | `components/common/EventLog.jsx` — 이벤트 로그 패널 (queryFilter 기반, 최신 20건) | `EventLog.jsx` |

#### 코드 리뷰 체크리스트

- [ ] `useWallet`이 Chain ID ≠ 11155111(Sepolia)일 때 경고 상태 반환
- [ ] `useContract`가 provider(읽기)와 signer(쓰기) 인스턴스를 분리
- [ ] `TxStatus`가 동시 다중 트랜잭션을 스택으로 표시 가능
- [ ] `EventLog`가 컨트랙트 배포 블록 이후 이벤트만 조회
- [ ] Pinata API Key가 환경변수에서만 읽힘 (`import.meta.env.VITE_*`)

#### 검증 및 테스트

- 브라우저에서 MetaMask 연결 → Header에 주소·역할 표시 확인
- Sepolia가 아닌 네트워크에서 접속 → 경고 배너 표시 확인
- Admin 계정으로 역할 드롭다운 → 5개 옵션 선택 가능 확인
- `uploadPdfToIpfs` 수동 테스트 → CID 반환 확인
- EventLog 패널 → 기존 Sepolia 이벤트 로드 확인

#### 사이드 이펙트 검증

- Workers API URL이 `.env`에 정확히 설정되었는지 확인
- Phase 7 API 엔드포인트를 프론트엔드에서 호출 시 CORS 에러 없음

#### 이전 Phase 회귀 테스트

- `npx hardhat test` 전체 통과

---

### Phase 9 — 프론트엔드: 역할 관리 + MTC 발행

**목표**: Admin이 역할을 등록·해제하고, Mill이 MTC를 발행하는 플로우를 UI로 완성한다. Scenario 1·2 E2E를 Sepolia에서 직접 시연 가능한 수준으로 완성한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 9-1 | `components/admin/RoleManager.jsx` — 지갑 주소 입력, 역할 선택 라디오, 등록 버튼, 등록 목록 + 해제 버튼 | `RoleManager.jsx` |
| 9-2 | `/admin` 페이지 라우팅 + 권한 가드 (Admin 아니면 리다이렉트) | `pages/Admin.jsx` |
| 9-3 | `components/mill/MtcIssuance.jsx` — 4개 섹션(기본정보·화학성분·기계적성질·PDF), IPFS 업로드 진행바, CID·해시 표시 | `MtcIssuance.jsx` |
| 9-4 | `/issue` 페이지 라우팅 + 권한 가드 | `pages/Issue.jsx` |
| 9-5 | `issueMtc` 트랜잭션 전송 → 성공 후 Workers API `POST /api/metadata` 호출 (트랜잭션 실패 시 메타데이터 저장 생략) | 트랜잭션 플로우 |

#### 코드 리뷰 체크리스트

- [ ] 역할 등록 폼: 주소 42자 형식 프론트 검증 + 컨트랙트 최종 검증 이중 구조
- [ ] MTC 발행 버튼은 IPFS 업로드 완료 후에만 활성화
- [ ] 컨트랙트 트랜잭션 실패 시 서버 메타데이터 저장 절대 호출되지 않음
- [ ] `TxStatus` 컴포넌트와 연동하여 전송 → 대기 → 완료/거부 Toast 표시

#### 검증 및 테스트 (Scenario E2E)

| Scenario | 단계 | 기대 결과 |
|---|---|---|
| Scenario 1 | Admin 지갑 → `/admin` → Mill/Fabricator/Integrator 역할 등록 | `RoleGranted` 이벤트, 목록 갱신 |
| Scenario 2 | Mill 모드 → `/issue` → H_001 (1,000 kg, SS400) 발행 + PDF 업로드 | `SteelMinted` 이벤트, Workers KV에 메타데이터 저장 확인 |

#### 사이드 이펙트 검증

- Phase 8 Header·EventLog 컴포넌트가 발행 이벤트를 정상 반영하는지 확인

#### 이전 Phase 회귀 테스트

- MetaMask 연결, 역할 드롭다운 (Phase 8 기능) 정상 동작 확인

---

### Phase 10 — 프론트엔드: 소유권 이전 + 강재 분할

**목표**: Scenario 3(소유권 이전)·4(분할)를 Sepolia에서 E2E 시연 가능하게 완성한다. 무게 검증 UI의 실시간 피드백이 컨트랙트 검증과 일치함을 확인한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 10-1 | Transfer 페이지 — 강재 조회, 수신자 주소 입력 + 역할 확인, 불가역 경고 | `pages/Transfer.jsx` |
| 10-2 | `transferOwnership` 트랜잭션 전송 플로우 | 트랜잭션 플로우 |
| 10-3 | `components/fabricator/SteelSplit.jsx` — 부모 강재 조회, 자식 무게 배열 입력, 실시간 무게 검증 프리뷰 (초록/빨강) | `SteelSplit.jsx` |
| 10-4 | `/split` 페이지 라우팅 + 권한 가드 | `pages/Split.jsx` |
| 10-5 | `splitSteel` 트랜잭션 전송 플로우 | 트랜잭션 플로우 |

#### 코드 리뷰 체크리스트

- [ ] 수신자 주소 [확인] 버튼: `hasMillRole`/`hasFabricatorRole`/`hasIntegratorRole` view 함수 조회
- [ ] 미등록 수신자 주소 시 [이전] 버튼 비활성
- [ ] 무게 검증 프리뷰: 손실률 % 실시간 계산, 10% 초과 시 즉시 빨강 + 버튼 비활성
- [ ] 무게 합계가 부모 초과 시에도 빨강 + 버튼 비활성

#### 검증 및 테스트 (Scenario E2E)

| Scenario | 기대 결과 |
|---|---|
| Scenario 3: H_001 → 가공사A 이전 | `SteelOwnershipTransferred` 이벤트, 소유자 변경 확인 |
| Scenario 4: H_001 5조각 분할 (950 kg 합계) | `SteelSplit` 이벤트, H_001_1~5 생성 확인 |
| Scenario 9 (사기): 분할 무게 합 1,100 kg (부모 초과) | UI에서 버튼 비활성 + 강제 전송 시 컨트랙트 revert 확인 |

#### 사이드 이펙트 검증

- Scenario 1·2 기능 (역할 관리, MTC 발행) 재확인

#### 이전 Phase 회귀 테스트

- Phase 8·9 공통 컴포넌트 (Header, TxStatus, EventLog) 정상 동작 확인

---

### Phase 11 — 프론트엔드: 강재 조합 + 사용 매핑

**목표**: Scenario 5(조합)·6(사용 매핑)을 완성한다. 조합 결과물의 새 MTC PDF 업로드 플로우와 사용 매핑의 불가역성 경고가 올바르게 동작함을 검증한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 11-1 | `components/fabricator/SteelCombine.jsx` — 부모 강재 동적 추가/제거, 합계 표시, 결과물 정보 입력, 무게 검증, 새 PDF 업로드 | `SteelCombine.jsx` |
| 11-2 | `/combine` 페이지 라우팅 + 권한 가드 | `pages/Combine.jsx` |
| 11-3 | `combineSteel` 트랜잭션 전송 → 성공 후 Workers `POST /api/metadata` (결과물 메타데이터) | 트랜잭션 플로우 |
| 11-4 | `components/integrator/SteelUsage.jsx` — 강재 조회, 부품 ID·설명 입력, 불가역 경고 (주황 배경) | `SteelUsage.jsx` |
| 11-5 | `/usage` 페이지 라우팅 + 권한 가드 | `pages/Usage.jsx` |
| 11-6 | `markAsUsed` 트랜잭션 전송 → 성공 후 Workers `POST /api/product` (부품 설명) | 트랜잭션 플로우 |

#### 코드 리뷰 체크리스트

- [ ] 조합 페이지: 부모 강재 1개 이하 시 [조합] 버튼 비활성
- [ ] 조합 페이지: 새 MTC PDF 업로드 완료 전 [조합] 버튼 비활성
- [ ] 사용 매핑: `markAsUsed` 트랜잭션 실패 시 Workers `POST /api/product` 호출 생략

#### 검증 및 테스트 (Scenario E2E)

| Scenario | 기대 결과 |
|---|---|
| Scenario 5: H_001_1 + OTHER_001 → PIPE_001 조합 | `SteelCombined` 이벤트, 부모 COMBINED, PIPE_001 생성 확인 |
| Scenario 6: PIPE_001 → P_001 사용 등록 | `SteelUsed` 이벤트, PIPE_001 상태 USED 확인 |

#### 사이드 이펙트 검증

- Scenario 10-C: USED 상태 강재 재사용 시도 → 컨트랙트 `SteelNotActive` revert 확인
- Scenario 1~4 기능 재확인

#### 이전 Phase 회귀 테스트

- Phase 9·10에서 구현된 모든 페이지 정상 진입 및 트랜잭션 플로우 확인

---

### Phase 12 — 프론트엔드: 이력 조회 + 트리 시각화 + PDF 검증

**목표**: 시스템의 핵심 가치인 이력 트리 시각화와 PDF 진본성 검증 기능을 완성한다. Scenario 7·8을 완전히 시연 가능하게 만든다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 12-1 | `components/auditor/SearchPanel.jsx` — 강재 ID / 부품 ID 라디오 + 검색 입력, URL 쿼리 반영 | `SearchPanel.jsx` |
| 12-2 | `components/auditor/SteelDetail.jsx` — 온체인 데이터 + KV 메타데이터 병렬 조회, 상태 뱃지, IPFS 링크 | `SteelDetail.jsx` |
| 12-3 | `components/auditor/AncestryTree.jsx` — React Flow 기반 트리 렌더링, 재귀 부모 조회(`getParents`), 노드 클릭 → `SteelDetail` 갱신 | `AncestryTree.jsx` |
| 12-4 | `components/auditor/PdfVerifier.jsx` — IPFS 다운로드 진행바, SHA-256 재계산, 온체인 `pdfHash` 비교, 검증/위조 결과 인라인 표시 | `PdfVerifier.jsx` |
| 12-5 | `/search` 페이지 조합 (SearchPanel + SteelDetail + AncestryTree + PdfVerifier) | `pages/Search.jsx` |

#### 코드 리뷰 체크리스트

- [ ] `getParents` 재귀 조회 시 순환 참조 방지 (visited set 사용)
- [ ] 트리 노드 색상이 상태(ACTIVE/SPLIT/COMBINED/USED)에 따라 올바르게 적용
- [ ] 부품 ID 조회 시 `getSteelByProduct` 호출 후 해당 강재 ID로 자동 재조회
- [ ] PDF 검증 실패 시 (해시 불일치) 빨강 경고 텍스트 명확히 표시
- [ ] "⚠ 서버 데이터 (참고용)" 주석이 화학성분·기계적성질 섹션에 표시됨

#### 검증 및 테스트 (Scenario E2E)

| Scenario | 기대 결과 |
|---|---|
| Scenario 7: 부품 ID `P_001` 검색 → 전체 트리 표시 | H_001·OTHER_001→H_001_1→PIPE_001→P_001 트리 렌더링 |
| Scenario 7: H_001 노드 클릭 | 좌측 상세 패널에 H_001 정보 전환 |
| Scenario 8: H_001 PDF 다운로드 + 검증 | "검증 완료 ✓ (해시 일치)" 표시 |
| Scenario 8 (변형): 다른 PDF로 검증 시도 | "위조 의심 ✗" 경고 표시 |

#### 사이드 이펙트 검증

- 대용량 트리(10노드 이상)에서 React Flow 렌더링 성능 확인
- 조회 응답시간 2초 이내 (SRS 비기능 요구사항) 확인

#### 이전 Phase 회귀 테스트

- Phase 9~11 모든 페이지 정상 동작 확인 (역할관리, 발행, 이전, 분할, 조합, 사용매핑)

---

### Phase 13 — 프론트엔드: 메인 페이지 + 사기 시연 완성

**목표**: 메인 페이지를 완성하고, Scenario 9·10의 사기 시도 거부 플로우가 UI까지 완전히 표현되는지 확인한다. 10개 전체 시나리오를 Sepolia에서 수동으로 처음부터 끝까지 시연한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 13-1 | `/` 메인 페이지 — 통합 검색 입력, 역할별 바로가기 카드 (3개), 최근 이벤트 목록 (5건), [전체 보기] | `pages/Home.jsx` |
| 13-2 | 에러 메시지 한글화 — 컨트랙트 Custom Error → UI 토스트 메시지 매핑 테이블 (`utils/errorMessages.js`) | `errorMessages.js` |
| 13-3 | Scenario 10-B용 UI 처리: Mill 역할 없는 지갑이 `/issue` 접근 시 "Mill 역할이 없습니다" 안내 (권한 가드) | 권한 가드 |

#### 코드 리뷰 체크리스트

- [ ] 최근 이벤트 목록: `SteelMinted`, `SteelSplit`, `SteelOwnershipTransferred`, `SteelCombined`, `SteelUsed` 5종 이벤트 표시
- [ ] 에러 메시지 매핑: 모든 Custom Error 코드에 한글 메시지 대응
- [ ] 역할별 바로가기: 지갑 미연결 시 클릭 → MetaMask 연결 요청 팝업

#### 검증 및 테스트 (Scenario E2E — 전체 10개)

| Scenario | 기대 결과 |
|---|---|
| 1: 역할 등록 | 완료 |
| 2: MTC 발행 | 완료 |
| 3: 소유권 이전 | 완료 |
| 4: 강재 분할 (정상) | 완료 |
| 5: 강재 조합 | 완료 |
| 6: 사용 매핑 | 완료 |
| 7: 전체 이력 조회 | 완료 |
| 8: PDF 검증 | 완료 |
| **9**: 무게 부풀리기 → revert | "거부됨: 자식 무게 합계가 부모 무게를 초과합니다" Toast |
| **10-B**: 권한 없는 발행 → revert | "거부됨: Mill(제강사) 역할이 없습니다" Toast |
| **10-C**: 이미 분할된 강재 재분할 → revert | "거부됨: 이미 분할·조합·사용된 강재입니다" Toast |

#### 사이드 이펙트 검증

- 전체 10개 Scenario를 신규 상태(초기 배포 후)에서 순서대로 실행하여 부작용 없음 확인

#### 이전 Phase 회귀 테스트

- `npx hardhat test` 전체 통과 (TC-001~TC-016)
- Phase 8~12 구현된 모든 페이지 정상 동작 확인

---

### Phase 14 — 전체 통합 + Cloudflare Pages 배포 + 최종 검증

**목표**: 프로덕션 환경(Cloudflare Pages + Cloudflare Workers + Sepolia)에서 퍼블릭 URL을 통해 전체 시나리오가 동작함을 최종 확인한다.

#### 구현 태스크

| # | 작업 | 산출물 |
|---|---|---|
| 14-1 | Cloudflare Pages 프로젝트 생성, GitHub 저장소 연동 | Pages 프로젝트 |
| 14-2 | Cloudflare Pages 환경변수 설정 (`VITE_CONTRACT_ADDRESS`, `VITE_PINATA_API_KEY`, `VITE_PINATA_API_SECRET`, `VITE_IPFS_GATEWAY`, `VITE_WORKERS_API_URL`, `VITE_WORKERS_API_KEY`) | 환경변수 완료 |
| 14-3 | 빌드 설정 확인 (`npm run build` → `dist/`, Node 20) | 빌드 성공 |
| 14-4 | Pages 배포 트리거 → 퍼블릭 URL 확보 | 배포 URL |
| 14-5 | 퍼블릭 URL에서 MetaMask 연결 → Scenario 1~10 전체 재실행 | 시연 완료 |
| 14-6 | 조회 응답 시간 측정 (목표: 2초 이내) | 성능 로그 |
| 14-7 | 최종 버그 수정 (배포 환경에서만 발생하는 이슈 처리) | 패치 커밋 |

#### 코드 리뷰 체크리스트

- [ ] `.env` 파일이 배포 번들에 포함되지 않음 (`.gitignore` + `dist` 제외)
- [ ] IPFS Gateway URL이 환경변수에서 읽힘 (하드코딩 없음)
- [ ] Pinata API Key가 브라우저 콘솔에 노출되지 않음

#### 검증 및 테스트 (최종)

- 퍼블릭 URL 접속 → 지갑 미연결 상태에서 메인·조회 페이지 정상 로드
- MetaMask Sepolia 연결 → 전체 Scenario 1~10 시연 성공
- 비 Sepolia 네트워크 접속 → 경고 배너 표시 확인
- Etherscan Sepolia에서 Phase 13에서 생성된 트랜잭션 해시 조회 가능 확인

#### 사이드 이펙트 검증

- Workers API CORS: Pages 도메인에서 API 호출 시 CORS 에러 없음
- `npm run build` 빌드 경고 없음 (미사용 import 등)

#### 이전 Phase 회귀 테스트 (최종 전체)

- `npx hardhat test` 전체 통과 (TC-001~TC-016)
- Cloudflare Pages 퍼블릭 URL에서 Scenario 1~10 전체 통과

---

### 구현 계획 요약

| Phase | 주제 | 레이어 | 누적 man-day |
|---|---|---|---|
| Phase 1 | 개발 환경 세팅 | 전체 | 1 |
| Phase 2 | 스마트 컨트랙트 — 역할 관리 | Contract | 2 |
| Phase 3 | 스마트 컨트랙트 — MTC 발행 + 소유권 이전 | Contract | 3 |
| Phase 4 | 스마트 컨트랙트 — 강재 분할 | Contract | 4 |
| Phase 5 | 스마트 컨트랙트 — 강재 조합 + 사용 매핑 + 조회 | Contract | 5 |
| Phase 6 | 스마트 컨트랙트 — Sepolia 배포 + 데모 스크립트 | Contract | 6 |
| Phase 7 | Cloudflare Workers 백엔드 API | Backend | 7 |
| Phase 8 | 프론트엔드 — 공통 인프라 + 헤더 + 공통 컴포넌트 | Frontend | 8 |
| Phase 9 | 프론트엔드 — 역할 관리 + MTC 발행 | Frontend | 9 |
| Phase 10 | 프론트엔드 — 소유권 이전 + 강재 분할 | Frontend | 10 |
| Phase 11 | 프론트엔드 — 강재 조합 + 사용 매핑 | Frontend | 11 |
| Phase 12 | 프론트엔드 — 이력 조회 + 트리 시각화 + PDF 검증 | Frontend | 12 |
| Phase 13 | 프론트엔드 — 메인 페이지 + 사기 시연 완성 | Frontend | 13 |
| Phase 14 | 전체 통합 + Cloudflare Pages 배포 + 최종 검증 | DevOps | 14 |

> **총 14 man-day** (약 3주, 주 5일 기준)

---

*문서 끝*  
---

## 부록 C: 기술 검증 결과 (2026-05-29)

> 본 문서의 기술적 구현 가능성을 검토하여 발견된 이슈와 조치 결과를 기록한다.

### C.1 발견 이슈 요약

| # | 위치 | 심각도 | 이슈 | 조치 |
|---|---|---|---|---|
| C-1 | §8.6 | **치명** | `string indexed` 이벤트 파라미터: ethers.js v6에서 `null` 반환, UI EventLog 패널 전체 파손 | 모든 `string indexed` → `string` (비인덱스)로 변경. `address`, `bytes32`만 indexed 유지 |
| C-2 | §8.6 | **치명** | `RoleGranted`/`RoleRevoked` 이벤트 재선언: OpenZeppelin `AccessControl`이 이미 정의 → 컴파일 에러 | 재선언 삭제, 주석으로 출처 명시 |
| C-3 | §8.5 / §8.7 | **치명** | `onlyRole(MILL_ROLE)` 수정자는 `AccessControlUnauthorizedAccount` 에러 발생 → `NotMill()` custom error 절대 발생 불가 | 수동 체크 패턴 `if (!hasRole(...)) revert NotXxx()`으로 변경 |
| C-4 | §8.5.5 | **높음** | `combineSteel` 의사코드 `sum(parentWeights)` 미정의 변수 사용 | 루프로 `steels[parentIds[i]].weight` 합산하는 코드로 교체 |
| C-5 | §8.5.5 | **높음** | `combineSteel` 최대 부모 수 미정의 → 부모 100개 입력 시 블록 가스 한도(~30M) 초과 위험 | `parentIds.length <= 10` 조건 추가, `InvalidParentCount` Custom Error 추가 |
| C-6 | §8.5.4 | **중간** | `splitSteel` 자동 생성 childId(`{parentId}_{N}`) 충돌 검사 누락 | 각 자식 생성 전 `steelExists[childId]` 검사 코드 명세 추가 |
| C-7 | §8.5.4/5 | **중간** | 무게 산술 `weight * 90 / 100`: Solidity 0.8+ 자동 overflow 방지이지만 `weight * 100 >= parent * 90` 형태가 더 명시적 | 안전한 산술 패턴으로 의사코드 교체 |
| C-8 | §8.6 | **중간** | `OwnershipTransferred` 이벤트명: OpenZeppelin `Ownable`의 동명 이벤트와 혼동 위험 (AccessControl만 사용 시 충돌 없으나 코드 가독성 문제) | `SteelOwnershipTransferred`로 이름 변경, 문서 전체 일괄 반영 |
| C-9 | §11-B | **낮음** | Cloudflare KV 최종 일관성(eventual consistency): POST 직후 GET 시 stale data 가능성 미언급 | 일관성 주의사항 및 재시도 권고 추가 |

### C.2 이슈별 기술 근거

#### C-1: `string indexed` in Solidity events

Solidity 황금 규칙: **동적 타입(`string`, `bytes`, 동적 배열)에 `indexed`를 사용하면 keccak256 해시가 topics에 저장된다.** 원본 값은 복구 불가하다.

```
// 잘못된 명세 (수정 전)
event SteelMinted(string indexed steelId, ...)
→ topics[1] = keccak256("H_001") = 0x8abc...
→ ethers.js v6: event.args.steelId === null  ← EventLog 표시 불가

// 올바른 명세 (수정 후)
event SteelMinted(string steelId, ...)
→ data field에 ABI 인코딩으로 저장
→ ethers.js v6: event.args.steelId === "H_001"  ← 정상 표시
```

인덱싱 가능 타입: `address` (20 bytes, topics에 zero-padded 저장), `bytes32` (고정 32 bytes, 온전히 저장), `uint256` 등 값 타입.

#### C-2: OpenZeppelin `RoleGranted`/`RoleRevoked` 상속

```solidity
// OpenZeppelin IAccessControl.sol 원문
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
```

`MtcRegistry`가 `AccessControl`을 상속하면 이 이벤트들이 자동으로 포함된다. 재선언 시 Solidity 컴파일러는 `"Event with same name and parameter types defined twice"` 에러를 발생시킨다.

#### C-3: `onlyRole` vs Custom Error

```solidity
// onlyRole 수정자 사용 시 (OpenZeppelin v5 기준)
// 역할 없을 때: revert AccessControlUnauthorizedAccount(account, neededRole)
// → NotMill(), NotFabricator(), NotIntegrator() 는 절대 발생하지 않음

// 수동 체크 패턴 (수정 후)
function issueMtc(...) external {
    if (!hasRole(MILL_ROLE, msg.sender)) revert NotMill();
    ...
}
// → UI에서 errorMessages.js가 NotMill() → "Mill(제강사) 역할이 없습니다" 로 변환 가능
```

#### C-5: `combineSteel` 가스 한도 분석

| 부모 수 | 예상 가스 | 판단 |
|---|---|---|
| 2개 | ~200,000 | 안전 |
| 10개 | ~900,000 | 안전 |
| 50개 | ~4,500,000 | 주의 (블록 한도 15%) |
| 100개 | ~9,000,000 | 위험 (블록 한도 30%) |

Ethereum 블록 가스 한도 약 30,000,000. 최대 10개로 제한하면 안전 범위 내.

### C.3 구현 시 주의사항 요약

1. **이벤트 구독**: `provider.getLogs()` 또는 `contract.queryFilter()`로 이벤트를 읽을 때, `string` 필드는 ABI 디코딩으로 원본 값을 얻는다. indexed로 지정된 `address`, `bytes32` 필드는 `event.args` 또는 `event.topics`에서 읽는다.

2. **에러 처리**: `errorMessages.js`는 다음 에러를 모두 처리해야 한다:
   - Custom Errors: `NotMill`, `NotFabricator`, `NotIntegrator`, `SteelExists`, `SteelNotFound`, `SteelNotActive`, `NotOwner`, `WeightExceedsParent`, `WeightLossExceeded`, `InvalidChildCount`, `InvalidParentCount`, `InvalidWeight`, `InvalidPdfHash`, `InvalidCid`, `InvalidProductId`, `InvalidRecipient`, `NeedMultipleParents`
   - OpenZeppelin 에러: `AccessControlUnauthorizedAccount` (관리자 전용 함수에서 `onlyRole` 수정자 사용 시)
   - MetaMask 거부: `user rejected transaction`

3. **splitSteel childIds 획득**: 트랜잭션 영수증에서 `SteelSplit` 이벤트를 파싱하여 `childIds` 배열을 획득한다. ethers.js:
   ```javascript
   const receipt = await tx.wait();
   const event = receipt.logs
     .map(log => contract.interface.parseLog(log))
     .find(e => e?.name === 'SteelSplit');
   const childIds = event.args.childIds;
   ```

4. **KV 재시도**: `POST /api/metadata` 후 조회 시 KV propagation을 위해 `GET /api/metadata/:steelId`를 최대 3회, 500ms 간격으로 재시도한다.

---

*버전: v1.2 | 최종 수정: 2026-05-29 (기술 검증 및 이슈 수정 완료) | 원본 작성일: 2026-05-26 | 작성자: 시니어 PM + 시니어 개발자 역할 (Claude Code)*

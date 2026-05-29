/**
 * MtcRegistry 컨트랙트 ABI (Phase 5 완성본)
 * 자동 생성: artifacts/contracts/MtcRegistry.sol/MtcRegistry.json
 * 함수 28개 / 이벤트 8개 / 에러 19개
 *
 * Sepolia 배포 후 addresses.js 에 CONTRACT_ADDRESS 추가 필요
 * (VITE_CONTRACT_ADDRESS 환경변수 또는 직접 수정)
 */
export const MTC_REGISTRY_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "name": "InvalidChildCount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidCid",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "name": "InvalidParentCount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPdfHash",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidProductId",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      }
    ],
    "name": "InvalidRecipient",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidWeight",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NeedMultipleParents",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotFabricator",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotIntegrator",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotMill",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "NotOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      }
    ],
    "name": "SteelExists",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "internalType": "enum MtcRegistry.SteelStatus",
        "name": "current",
        "type": "uint8"
      }
    ],
    "name": "SteelNotActive",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      }
    ],
    "name": "SteelNotFound",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "childTotal",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "parentWeight",
        "type": "uint256"
      }
    ],
    "name": "WeightExceedsParent",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "childTotal",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "minRequired",
        "type": "uint256"
      }
    ],
    "name": "WeightLossExceeded",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string[]",
        "name": "parentIds",
        "type": "string[]"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "childId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalParentWeight",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "childWeight",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SteelCombined",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "mill",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "weight",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "ipfsCid",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "pdfHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SteelMinted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SteelOwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "parentId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string[]",
        "name": "childIds",
        "type": "string[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "parentWeight",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256[]",
        "name": "childWeights",
        "type": "uint256[]"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SteelSplit",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "productId",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "integrator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SteelUsed",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "FABRICATOR_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "INTEGRATOR_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MILL_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string[]",
        "name": "parentIds",
        "type": "string[]"
      },
      {
        "internalType": "string",
        "name": "childId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "childWeight",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "ipfsCid",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "pdfHash",
        "type": "bytes32"
      }
    ],
    "name": "combineSteel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      }
    ],
    "name": "getChildren",
    "outputs": [
      {
        "internalType": "string[]",
        "name": "",
        "type": "string[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      }
    ],
    "name": "getParents",
    "outputs": [
      {
        "internalType": "string[]",
        "name": "",
        "type": "string[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      }
    ],
    "name": "getSteel",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "steelId",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "weight",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "ipfsCid",
            "type": "string"
          },
          {
            "internalType": "bytes32",
            "name": "pdfHash",
            "type": "bytes32"
          },
          {
            "internalType": "enum MtcRegistry.SteelStatus",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "address",
            "name": "mill",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          },
          {
            "internalType": "string[]",
            "name": "parentIds",
            "type": "string[]"
          },
          {
            "internalType": "string[]",
            "name": "childIds",
            "type": "string[]"
          }
        ],
        "internalType": "struct MtcRegistry.Steel",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "productId",
        "type": "string"
      }
    ],
    "name": "getSteelByProduct",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantFabricator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantIntegrator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantMill",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasFabricatorRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasIntegratorRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasMillRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "weight",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "ipfsCid",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "pdfHash",
        "type": "bytes32"
      }
    ],
    "name": "issueMtc",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "productId",
        "type": "string"
      }
    ],
    "name": "markAsUsed",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeFabricator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeIntegrator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeMill",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "parentId",
        "type": "string"
      },
      {
        "internalType": "uint256[]",
        "name": "childWeights",
        "type": "uint256[]"
      }
    ],
    "name": "splitSteel",
    "outputs": [
      {
        "internalType": "string[]",
        "name": "childIds",
        "type": "string[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "steelId",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

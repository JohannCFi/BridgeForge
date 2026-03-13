# EURCV Bridge — Design Specification

## Contexte

BridgeForge est un bridge cross-chain pour le token EURCV de SG Forge. Forge, en tant qu'émetteur du token, opère le bridge et détient les clés issuer sur les 4 chaînes supportées : Ethereum, Solana, XRPL et Stellar.

Le protocole permet à tout détenteur d'EURCV de transférer ses tokens d'une chaîne à l'autre (12 directions possibles) via un mécanisme de **burn & mint**.

## Décisions de design validées

| Décision | Choix | Raison |
|----------|-------|--------|
| Mécanisme de bridge | Burn & mint sur les 4 chaînes | Forge contrôle le mint partout. Pas besoin de pools de liquidité ou de wrapped tokens |
| Attestation | Forge = seul attestateur (style CCTP) | Cohérent : l'émetteur est naturellement l'attestateur. Entité régulée |
| Vérification ETH/Solana | On-chain (smart contracts) | Permissionless recovery, transparence, auditabilité |
| Vérification XRPL/Stellar | Off-chain (backend) | Pas de smart contracts sur ces chaînes. Trust model déjà centralisé (trustlines) |
| Base de données | PostgreSQL | Transactions ACID, fiabilité critique pour un bridge financier |
| Protection des fonds | Pre-check + retry + refund automatique | L'utilisateur ne peut jamais perdre ses fonds |

## Architecture globale

3 couches distinctes :

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  React + Wagmi/Solana Adapter/Crossmark/Freighter            │
│  UX unifiée : connect wallets → amount → sign burn → done    │
└─────────────────┬───────────────────────────────┬────────────┘
                  │ POST /transfer (intent)        │ POST /transfer/:id/confirm-burn
                  ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Forge)                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ TransferMgr  │→ │ Attestation  │→ │   MintExecutor    │  │
│  │              │  │   Service    │  │                   │  │
│  │ - intent     │  │ - verify burn│  │ - mint on dest    │  │
│  │ - pre-check  │  │ - sign msg   │  │ - retry + backoff │  │
│  │ - status     │  │ - persist    │  │ - refund on fail  │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                   Chain Adapters                          ││
│  │  ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐         ││
│  │  │Ethereum │ │ Solana │ │  XRPL  │ │ Stellar │         ││
│  │  │ERC-20   │ │  SPL   │ │Trustline│ │Trustline│         ││
│  │  └─────────┘ └────────┘ └────────┘ └─────────┘         ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SMART CONTRACTS                            │
│                  (ETH + Solana uniquement)                    │
│                                                              │
│  EURCVBridge          EURCVToken                             │
│  - depositForBurn()   - mint() / burn()                      │
│  - receiveMessage()   - MINTER_ROLE → Bridge contract        │
│  - verify attestation                                        │
└─────────────────────────────────────────────────────────────┘
```

## Flow détaillé : burn & mint

### Chaînes programmables (ETH/Solana) — source

1. User appelle `depositForBurn(amount, destDomain, recipient)` sur le contrat `EURCVBridge`
2. Le contrat burn les tokens via `EURCVToken.burn()`
3. Le contrat émet un `BurnEvent` avec transferId, sender, amount, destDomain, recipient
4. Le backend indexe l'event, vérifie on-chain, signe le `BridgeMessage` (attestation ECDSA)
5. L'attestation est persistée en DB

### Chaînes programmables (ETH/Solana) — destination

1. Le backend (ou n'importe quel relayer) appelle `receiveMessage(message, attestation)`
2. Le contrat vérifie la signature via `ecrecover` (ETH) ou `ed25519_verify` (Solana)
3. Le contrat vérifie le nonce (anti-replay)
4. Le contrat mint les tokens au destinataire
5. **Permissionless recovery** : n'importe qui peut soumettre l'attestation

### Chaînes non-programmables (XRPL/Stellar) — source

1. User enregistre l'intent via `POST /transfer` (chaîne source, dest, montant, recipient)
2. Backend fait un pre-check (chaîne dest up, balance, etc.) et répond `ready_to_burn`
3. User signe un Payment vers l'adresse issuer Forge dans son wallet (Crossmark/GemWallet/Freighter)
4. Le champ Memo de la transaction contient le `transferId`
5. User confirme le burn via `POST /transfer/:id/confirm-burn` avec le txHash
6. Backend vérifie on-chain : tx existe, status success, destination = issuer, montant correct, memo = transferId
7. Backend signe le BridgeMessage (attestation) et persiste en DB

### Chaînes non-programmables (XRPL/Stellar) — destination

1. Backend exécute un Payment depuis le compte issuer Forge vers le destinataire
2. Les tokens sont créés nativement (obligation trustline)
3. Si échec : retry avec backoff exponentiel (10 tentatives, ~85min total)
4. Si échec après tous les retries : refund automatique (re-mint sur la chaîne source)

### Pourquoi burn & mint fonctionne nativement sur XRPL/Stellar

Le modèle trustline est intrinsèquement un système de burn & mint :

| Concept | XRPL | Stellar |
|---------|------|---------|
| **Mint** | Payment depuis issuer → obligation créée, tokens émis | Payment depuis issuer → idem |
| **Burn** | Payment vers issuer → obligation réduite, tokens détruits | Payment vers issuer → idem |
| **Prérequis** | TrustLine active vers l'issuer EURCV | changeTrust vers l'issuer |
| **Memo** | Champ `Memos[]` natif (hex-encoded) | Champ `memo` natif |
| **Vérification** | API `tx` ou `account_tx` via WebSocket | Horizon API `GET /transactions/:hash/operations` |

## Toutes les routes supportées

| Route | Burn (source) | Mint (destination) | Attestation |
|-------|--------------|-------------------|-------------|
| ETH → Solana | `burn()` smart contract | `mint()` smart contract | On-chain des deux côtés |
| ETH → XRPL | `burn()` smart contract | Payment from issuer | On-chain burn, off-chain mint |
| ETH → Stellar | `burn()` smart contract | Payment from issuer | On-chain burn, off-chain mint |
| Solana → ETH | `burn()` SPL token | `mint()` smart contract | On-chain des deux côtés |
| Solana → XRPL | `burn()` SPL token | Payment from issuer | On-chain burn, off-chain mint |
| Solana → Stellar | `burn()` SPL token | Payment from issuer | On-chain burn, off-chain mint |
| XRPL → ETH | Payment to issuer | `mint()` smart contract | Off-chain burn, on-chain mint |
| XRPL → Solana | Payment to issuer | `mint()` SPL token | Off-chain burn, on-chain mint |
| XRPL → Stellar | Payment to issuer | Payment from issuer | Off-chain des deux côtés |
| Stellar → ETH | Payment to issuer | `mint()` smart contract | Off-chain burn, on-chain mint |
| Stellar → Solana | Payment to issuer | `mint()` SPL token | Off-chain burn, on-chain mint |
| Stellar → XRPL | Payment to issuer | Payment from issuer | Off-chain des deux côtés |

## Smart Contracts (ETH/Solana)

### Format du message attesté

```
struct BridgeMessage {
    uint32  version;        // version du protocole (1)
    bytes32 transferId;     // identifiant unique
    uint32  sourceDomain;   // 0=ETH, 1=Solana, 2=XRPL, 3=Stellar
    uint32  destDomain;     // idem
    bytes32 sender;         // adresse source (32 bytes, padded)
    bytes32 recipient;      // adresse destination (32 bytes, padded)
    uint256 amount;         // montant en plus petite unité
    bytes32 burnTxHash;     // hash de la tx de burn
}
```

L'attestation est la signature ECDSA (ETH) ou Ed25519 (Solana) de `keccak256(abi.encode(message))`.

### Contrat EURCVBridge

- `depositForBurn(amount, destDomain, recipient)` — burn les tokens, émet BurnEvent
- `receiveMessage(message, attestation)` — vérifie signature + nonce, mint les tokens
- `setAttester(address)` — clé publique Forge (admin only)
- `pause() / unpause()` — circuit breaker (admin only)
- `setMaxAmount(uint256)` — plafond par transaction (admin only)

### Contrat EURCVToken

- ERC-20 standard avec `mint()` et `burn()`
- `MINTER_ROLE` attribué au contrat Bridge
- `DEFAULT_ADMIN_ROLE` attribué au multisig Forge

### Solana

Même logique, implémenté en Rust (Anchor) :
- SPL Token avec Mint Authority = programme Bridge
- Vérification de signature via le programme `ed25519_program`
- Anti-replay via PDA avec seed = transferId

### Sécurités on-chain

1. **Anti-replay** — chaque transferId ne peut être utilisé qu'une seule fois
2. **Pause/circuit breaker** — Forge peut pauser en cas d'exploit
3. **Plafond par transaction** — `maxAmount` configurable
4. **Plafond par période** — rate limiting optionnel (ex: max 1M EURCV/24h)
5. **Vérification du domaine** — le contrat ETH n'accepte que `destDomain == 0`

## Backend

### Stack technique

| Composant | Choix |
|-----------|-------|
| Runtime | Node.js + TypeScript |
| Framework | Express |
| Base de données | PostgreSQL |
| ORM | Prisma |
| Queue | Bull (Redis) |
| Monitoring | Winston + Sentry |

### Services

- **TransferService** — crée l'intent, fait le pre-check, expose le statut
- **AttestationService** — vérifie le burn on-chain, signe le BridgeMessage, persiste l'attestation
- **MintExecutor (Bull queue)** — exécute le mint, retry avec backoff exponentiel, refund si échec total
- **ChainStatusService** — poll les 4 chaînes toutes les 30s, expose `isHealthy()`

### Chain Adapters

Interface commune pour toutes les chaînes :

```typescript
interface ChainAdapter {
  verifyBurn(txHash: string): Promise<BurnProof>
  executeMint(transfer: Transfer): Promise<MintResult>
  refund(transfer: Transfer): Promise<RefundResult>
  getBalance(address: string): Promise<bigint>
  isHealthy(): Promise<boolean>
}
```

Implémentations : `EthereumAdapter` (ethers.js), `SolanaAdapter` (@solana/web3.js), `XrplAdapter` (xrpl.js), `StellarAdapter` (stellar-sdk).

### API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/transfer` | Créer un intent de transfer |
| POST | `/transfer/:id/confirm-burn` | Confirmer la tx de burn |
| GET | `/transfer/:id` | Statut d'un transfer |
| GET | `/transfers?wallet=...` | Historique d'un wallet |
| GET | `/health` | Healthcheck + statut des chaînes |

### Modèle de données

```sql
CREATE TABLE transfers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',

    source_chain      VARCHAR(10) NOT NULL,
    source_address    VARCHAR(100) NOT NULL,
    burn_tx_hash      VARCHAR(100),
    burn_confirmed_at TIMESTAMPTZ,

    dest_chain        VARCHAR(10) NOT NULL,
    dest_address      VARCHAR(100) NOT NULL,
    mint_tx_hash      VARCHAR(100),
    mint_confirmed_at TIMESTAMPTZ,

    amount            DECIMAL(38, 18) NOT NULL,

    attestation       BYTEA,
    message_hash      VARCHAR(66),

    refund_tx_hash    VARCHAR(100),
    refund_at         TIMESTAMPTZ,

    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    retry_count       INT DEFAULT 0,
    error_log         TEXT
);

CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_source ON transfers(source_address, source_chain);
CREATE INDEX idx_transfers_dest ON transfers(dest_address, dest_chain);

CREATE TABLE used_nonces (
    transfer_id UUID PRIMARY KEY REFERENCES transfers(id),
    chain       VARCHAR(10) NOT NULL,
    used_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chain_status (
    chain           VARCHAR(10) PRIMARY KEY,
    is_healthy      BOOLEAN DEFAULT TRUE,
    last_block      BIGINT,
    last_checked_at TIMESTAMPTZ,
    error_message   TEXT
);
```

### Machine à états

```
pending → ready → burn_confirmed → attested → minting → completed
                                                     ↘ mint_failed → refunding → refunded
```

- `pending` : intent créé, pre-check en cours
- `ready` : pre-check OK, en attente du burn par l'utilisateur
- `burn_confirmed` : burn vérifié on-chain, attestation en cours
- `attested` : message signé, mint en queue
- `minting` : tx mint soumise, en attente de confirmation
- `completed` : mint confirmé, transfer terminé
- `mint_failed` : mint échoué après tous les retries
- `refunding` : refund en cours (re-mint sur source)
- `refunded` : refund confirmé, utilisateur remboursé

### MintQueue (Bull)

- **Retries** : 10 tentatives avec backoff exponentiel (5s, 10s, 20s... ~85min total)
- **Timeout** : 1h maximum
- **On failure** : déclenche le refund automatique (re-mint sur source)
- **Persistance** : jobs stockés dans Redis, survivent aux redémarrages

### Sécurité backend

- Clé privée issuer en variable d'environnement (HSM en prod)
- Rate limiting par IP et par wallet
- Validation Zod sur tous les inputs API
- CORS restreint au domaine du frontend
- Idempotence via transferId UUID
- Audit trail : chaque changement de statut est loggé

## Frontend

### Principe

L'utilisateur ne sait jamais quelle mécanique tourne derrière. Le flow est identique pour les 12 routes :

```
Connecter wallet source → Connecter wallet destination → Montant → Bridge → Terminé
```

### Wallets supportés

| Chaîne | Wallets | SDK |
|--------|---------|-----|
| Ethereum | MetaMask, Rabby | wagmi + viem |
| Solana | Phantom, Solflare | @solana/wallet-adapter |
| XRPL | Crossmark, GemWallet | @crossmarkio/sdk |
| Stellar | Freighter | @stellar/freighter-api |

### UI : BridgePanel

- Sélection chaîne source + wallet source
- Sélection chaîne destination + wallet destination
- Validation : `sourceChain !== destChain` (déjà implémenté)
- Input montant avec validation balance
- Résumé avant confirmation (montant envoyé, montant reçu, frais réseau estimés)
- Bouton Bridge **grisé** si source ou destination down

### UI : TransferProgress

Stepper de progression en temps réel :
1. Préparation ✅
2. Signature (en attente dans le wallet)
3. Burn confirmé (avec lien explorateur)
4. Mint en cours
5. Terminé (avec lien explorateur destination)

Message : "Vous pouvez fermer cette page, vous recevrez vos fonds automatiquement"

### Polling

Le frontend poll `GET /transfer/:id` toutes les 3 secondes pendant un transfer actif. Le polling s'arrête quand le statut est `completed` ou `refunded`.

### Cas d'erreur

| Situation | Affichage |
|-----------|-----------|
| Chaîne source down | Bouton grisé + "[Chaîne] est temporairement indisponible" |
| Chaîne destination down | Bouton grisé + "[Chaîne] est temporairement indisponible" |
| Les deux down | Bouton grisé + "[Source] et [Destination] sont temporairement indisponibles" |
| Balance insuffisante | Message d'erreur avec solde actuel vs montant demandé |
| Pas de trustline (XRPL/Stellar) | Alerte avec instructions pour activer la trustline |
| Mint échoué → refund | Notification avec tx de refund |
| User ferme la page | Le mint continue côté backend. Au retour, la page affiche le statut actuel |

### Structure des composants

```
frontend/src/
├── components/
│   ├── bridge/
│   │   ├── BridgePanel.tsx
│   │   ├── ChainSelector.tsx
│   │   ├── WalletConnector.tsx
│   │   ├── TransferProgress.tsx
│   │   ├── TransferSummary.tsx
│   │   └── TransferHistory.tsx
│   └── common/
│       ├── TrustlineWarning.tsx
│       └── ChainStatusBadge.tsx
├── hooks/
│   ├── useWallet.ts
│   ├── useTransferStatus.ts
│   ├── useChainStatus.ts
│   └── useBridge.ts
└── adapters/
    ├── ethereum.ts
    ├── solana.ts
    ├── xrpl.ts
    └── stellar.ts
```

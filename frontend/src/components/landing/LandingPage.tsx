import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Shield, Zap, Globe, Layers, Award, BookOpen } from "lucide-react";

interface LandingPageProps {
  onLaunchApp: () => void;
}

/* ───────────── helpers ───────────── */

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s cubic-bezier(.25,.46,.45,.94) ${delay}s, transform 0.6s cubic-bezier(.25,.46,.45,.94) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ───────────── data ───────────── */

const CHAINS = [
  { name: "Ethereum", icon: "/icons/ethereum.png", network: "Sepolia Testnet" },
  { name: "Solana", icon: "/icons/solana.svg", network: "Devnet" },
  { name: "XRPL", icon: "/icons/xrpl.svg", network: "Testnet" },
  { name: "Stellar", icon: "/icons/Stellar.png", network: "Testnet" },
];

const KEY_FEATURES = [
  {
    icon: <Shield size={22} />,
    title: "Institutional-Grade Security",
    desc: "Multi-signature validation and on-chain proof of every transfer. Assets never leave auditable custody, ensuring full regulatory compliance.",
  },
  {
    icon: <Zap size={22} />,
    title: "Burn & Mint Architecture",
    desc: "Native burn-and-mint eliminates wrapped tokens entirely. No intermediary assets, no counterparty risk — just direct cross-chain settlement.",
  },
  {
    icon: <Globe size={22} />,
    title: "Multi-Chain Native",
    desc: "A single unified interface bridging EVM, Solana, XRPL, and Stellar. Four blockchains, one seamless experience for institutional operators.",
  },
  {
    icon: <Layers size={22} />,
    title: "Full Transparency",
    desc: "Every transaction is traceable and auditable on-chain. Real-time status tracking, complete history, and zero opacity on operations.",
  },
];

const RELATED_PRODUCTS = [
  {
    title: "Structured Products",
    desc: "Tokenized financial instruments on-chain with full lifecycle management.",
    href: "#",
  },
  {
    title: "Smart Cash",
    desc: "Programmable digital cash for institutional treasury and settlement operations.",
    href: "#",
  },
  {
    title: "Digital Securities",
    desc: "End-to-end issuance, distribution, and secondary trading of digital securities.",
    href: "#",
  },
];

/* ───────────── component ───────────── */

export function LandingPage({ onLaunchApp }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sg-root">
      {/* ─── NAV ─── */}
      <nav className={`sg-nav ${scrolled ? "sg-nav--scrolled" : ""}`}>
        <div className="sg-nav-inner">
          <div className="sg-nav-left">
            <img src="/forge-logo.png" alt="SG Forge" className="sg-nav-logo" />
            <div className="sg-nav-divider" />
            <span className="sg-nav-product-label">BridgeForge</span>
          </div>
          <div className="sg-nav-links">
            <a href="#overview">Overview</a>
            <a href="#features">Features</a>
            <a href="#networks">Networks</a>
            <a href="#products">Products</a>
          </div>
          <button onClick={onLaunchApp} className="sg-nav-cta">
            Launch App <ArrowUpRight size={14} />
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="sg-hero">
        <div className="sg-hero-inner">
          <Reveal>
            <div className="sg-hero-badge">
              <span className="sg-hero-badge-dot" />
              SG Forge Product
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="sg-hero-title">BridgeForge</h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="sg-hero-subtitle">
              Cross-chain token bridge infrastructure
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="sg-hero-desc">
              BridgeForge provides institutional-grade cross-chain transfer capabilities,
              enabling seamless movement of digital assets between Ethereum, Solana, XRPL, and Stellar
              through a secure burn-and-mint architecture.
            </p>
          </Reveal>
          <Reveal delay={0.26}>
            <div className="sg-hero-actions">
              <button onClick={onLaunchApp} className="sg-btn-primary">
                Access the Bridge <ArrowRight size={15} />
              </button>
              <a href="#features" className="sg-btn-secondary">
                <BookOpen size={15} /> Read documentation
              </a>
            </div>
          </Reveal>
        </div>

        {/* Hero visual — chain icons orbit */}
        <Reveal delay={0.1} className="sg-hero-visual">
          <div className="sg-hero-card">
            <div className="sg-hero-card-grid">
              {CHAINS.map((c) => (
                <div key={c.name} className="sg-hero-chain-item">
                  <img src={c.icon} alt={c.name} className="sg-hero-chain-icon" />
                  <div>
                    <span className="sg-hero-chain-name">{c.name}</span>
                    <span className="sg-hero-chain-net">{c.network}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="sg-hero-card-footer">
              <span>4 supported networks</span>
              <span className="sg-hero-card-status">
                <span className="sg-status-dot" />
                Testnet Live
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── SEPARATOR ─── */}
      <div className="sg-separator" />

      {/* ─── OVERVIEW ─── */}
      <section id="overview" className="sg-section">
        <div className="sg-section-inner sg-overview">
          <Reveal className="sg-overview-left">
            <p className="sg-overline">Overview</p>
            <h2 className="sg-h2">
              The easiest way to move assets<br />across blockchains.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="sg-overview-right">
            <p className="sg-body">
              BridgeForge was developed as a core infrastructure product for cross-chain interoperability.
              By leveraging a burn-and-mint mechanism, it eliminates the need for wrapped tokens
              and removes intermediary counterparty risk.
            </p>
            <p className="sg-body">
              Designed to meet the requirements of regulated financial institutions, BridgeForge
              provides full auditability, on-chain traceability, and compliance-ready architecture
              from inception.
            </p>
            <div className="sg-stats-row">
              <div className="sg-stat">
                <span className="sg-stat-value">4</span>
                <span className="sg-stat-label">Supported Chains</span>
              </div>
              <div className="sg-stat">
                <span className="sg-stat-value">&lt;30s</span>
                <span className="sg-stat-label">Settlement Time</span>
              </div>
              <div className="sg-stat">
                <span className="sg-stat-value">0</span>
                <span className="sg-stat-label">Wrapped Tokens</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="sg-section sg-section--gray">
        <div className="sg-section-inner">
          <Reveal>
            <p className="sg-overline">Key Features</p>
            <h2 className="sg-h2">Built for trust, engineered for speed</h2>
          </Reveal>
          <div className="sg-features-grid">
            {KEY_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={0.06 * i} className="sg-feature-card">
                <div className="sg-feature-icon">{f.icon}</div>
                <h3 className="sg-feature-title">{f.title}</h3>
                <p className="sg-feature-desc">{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="sg-section">
        <div className="sg-section-inner">
          <Reveal>
            <p className="sg-overline">Process</p>
            <h2 className="sg-h2">How it works</h2>
          </Reveal>
          <div className="sg-process">
            <Reveal delay={0} className="sg-process-step">
              <div className="sg-process-num">1</div>
              <div className="sg-process-content">
                <h3 className="sg-process-title">Connect your wallet</h3>
                <p className="sg-process-desc">
                  Link your wallet on any supported chain — MetaMask, Phantom, Crossmark, Freighter, and more.
                  BridgeForge detects available wallets automatically.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="sg-process-step">
              <div className="sg-process-num">2</div>
              <div className="sg-process-content">
                <h3 className="sg-process-title">Configure the transfer</h3>
                <p className="sg-process-desc">
                  Choose source and destination chains, enter the amount, and review the details.
                  The interface validates parameters in real time before submission.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.16} className="sg-process-step">
              <div className="sg-process-num">3</div>
              <div className="sg-process-content">
                <h3 className="sg-process-title">Bridge</h3>
                <p className="sg-process-desc">
                  Confirm the transaction. Tokens are burned on the source chain and minted on
                  the destination. Track settlement in real time from the transactions panel.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── NETWORKS ─── */}
      <section id="networks" className="sg-section sg-section--dark">
        <div className="sg-section-inner">
          <Reveal>
            <p className="sg-overline sg-overline--light">Supported Networks</p>
            <h2 className="sg-h2 sg-h2--light">Four chains, one bridge</h2>
          </Reveal>
          <div className="sg-networks-grid">
            {CHAINS.map((c, i) => (
              <Reveal key={c.name} delay={0.06 * i} className="sg-network-card">
                <img src={c.icon} alt={c.name} className="sg-network-icon" />
                <span className="sg-network-name">{c.name}</span>
                <span className="sg-network-env">{c.network}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── RECOGNITION ─── */}
      <section className="sg-section">
        <div className="sg-section-inner sg-recognition">
          <Reveal className="sg-recognition-left">
            <p className="sg-overline">Recognition</p>
            <h2 className="sg-h2">Trusted by the industry</h2>
          </Reveal>
          <div className="sg-recognition-cards">
            <Reveal delay={0} className="sg-recognition-card">
              <Award size={24} className="sg-recognition-icon" />
              <div>
                <p className="sg-recognition-title">Built on SG Forge infrastructure</p>
                <p className="sg-recognition-desc">
                  Leveraging 150+ years of Société Générale's expertise in financial markets,
                  combined with cutting-edge blockchain technology.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08} className="sg-recognition-card">
              <Shield size={24} className="sg-recognition-icon" />
              <div>
                <p className="sg-recognition-title">Compliance-ready architecture</p>
                <p className="sg-recognition-desc">
                  Designed to meet regulatory requirements from day one.
                  Full KYC/AML integration path and on-chain audit trail.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── RELATED PRODUCTS ─── */}
      <section id="products" className="sg-section sg-section--gray">
        <div className="sg-section-inner">
          <Reveal>
            <p className="sg-overline">Explore</p>
            <h2 className="sg-h2">Related products</h2>
          </Reveal>
          <div className="sg-related-grid">
            {RELATED_PRODUCTS.map((p, i) => (
              <Reveal key={p.title} delay={0.06 * i} className="sg-related-card">
                <h3 className="sg-related-title">{p.title}</h3>
                <p className="sg-related-desc">{p.desc}</p>
                <span className="sg-related-link">
                  Learn more <ArrowUpRight size={14} />
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="sg-cta-banner">
        <div className="sg-section-inner sg-cta-banner-inner">
          <Reveal>
            <h2 className="sg-cta-title">Ready to bridge your assets?</h2>
            <p className="sg-cta-desc">
              Connect your wallet and start transferring tokens across chains in seconds.
            </p>
            <button onClick={onLaunchApp} className="sg-btn-primary sg-btn-primary--light">
              Launch BridgeForge <ArrowRight size={15} />
            </button>
          </Reveal>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="sg-footer">
        <div className="sg-footer-inner">
          <div className="sg-footer-col sg-footer-col--brand">
            <img src="/forge-logo.png" alt="SG Forge" className="sg-footer-logo" />
            <p className="sg-footer-tagline">
              Building on 150+ years of financial expertise to shape the future of digital assets.
            </p>
          </div>
          <div className="sg-footer-col">
            <h4 className="sg-footer-heading">Products</h4>
            <a href="#">BridgeForge</a>
            <a href="#">Structured Products</a>
            <a href="#">Smart Cash</a>
            <a href="#">Digital Securities</a>
          </div>
          <div className="sg-footer-col">
            <h4 className="sg-footer-heading">Resources</h4>
            <a href="#">Documentation</a>
            <a href="#">API Reference</a>
            <a href="#">Status</a>
          </div>
          <div className="sg-footer-col">
            <h4 className="sg-footer-heading">Legal</h4>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Cookie Policy</a>
          </div>
        </div>
        <div className="sg-footer-bottom">
          <p>© 2026 SG Forge — Société Générale Group. All rights reserved.</p>
          <p className="sg-footer-env">Testnet Environment</p>
        </div>
      </footer>
    </div>
  );
}

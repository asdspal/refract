export default function HomePage() {
  return (
    <section className="card" aria-labelledby="home-heading">
      <h1 id="home-heading">Refract</h1>
      <p className="muted">
        Fund a private, yield-bearing API pass from any of 35+ chains and pay
        x402 APIs without leaking your wallet identity.
      </p>
      <nav aria-label="Studio entry points">
        <ul>
          <li>
            <a href="/studio">Prism Studio — deposit &amp; mint note</a>
          </li>
          <li>
            <a href="/playground">x402 AI Playground</a>
          </li>
          <li>
            <a href="/merchant">Merchant &amp; DeFi Treasury</a>
          </li>
        </ul>
      </nav>
    </section>
  );
}

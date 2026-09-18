import { SignIn } from '@clerk/nextjs'

export default function SignInPage(){
  return <main className="finora-auth">
    <section className="finora-auth-visual">
      <div className="finora-auth-brand"><span className="finora-auth-mark"/><strong>Finora</strong></div>
      <div className="finora-auth-kicker">Financial Operations Workspace</div>
      <h1 className="finora-auth-title">One workspace for every financial decision.</h1>
      <p className="finora-auth-copy">Kelola proposal, project, invoice, pembayaran, biaya, dan cash flow dalam satu alur kerja finansial yang rapi.</p>
      <div className="finora-auth-meta">Focused · Professional · Built for control</div>
    </section>
    <section className="finora-auth-panel">
      <div className="finora-auth-card">
        <div className="finora-auth-card-kicker">01 · Sign in</div>
        <h1>Welcome back.</h1>
        <p>Masuk untuk melanjutkan ke financial operations workspace Anda.</p>
        <div className="finora-auth-clerk"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" /></div>
        <div className="finora-auth-foot">Finora keeps commercial, billing, cash flow and control in one place.</div>
      </div>
    </section>
  </main>
}

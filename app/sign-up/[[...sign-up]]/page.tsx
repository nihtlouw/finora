import { SignUp } from '@clerk/nextjs'

export default function SignUpPage(){
  return <main className="finora-auth">
    <section className="finora-auth-visual">
      <div className="finora-auth-brand"><span className="finora-auth-mark"/><strong>Finora</strong></div>
      <div className="finora-auth-kicker">Financial Operations Workspace</div>
      <h1 className="finora-auth-title">Build financial control from day one.</h1>
      <p className="finora-auth-copy">Buat workspace dan mulai kelola klien, proposal, invoice, biaya, cash flow, dan reporting tanpa memecah proses ke banyak tempat.</p>
      <div className="finora-auth-meta">Simple system · Clear numbers · Better control</div>
    </section>
    <section className="finora-auth-panel">
      <div className="finora-auth-card">
        <div className="finora-auth-card-kicker">Create workspace</div>
        <h1>Start with Finora.</h1>
        <p>Buat akun untuk mulai membangun financial operations workspace Anda.</p>
        <div className="finora-auth-clerk"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></div>
        <div className="finora-auth-foot">Your account controls access to the workspace and its financial data.</div>
      </div>
    </section>
  </main>
}

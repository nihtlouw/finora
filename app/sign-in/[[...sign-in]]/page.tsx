import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f8f6] px-4 py-8">
      <SignIn />
    </main>
  )
}

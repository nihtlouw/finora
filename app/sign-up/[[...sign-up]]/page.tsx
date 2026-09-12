import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f7f8f6] px-4 py-8">
      <SignUp />
    </main>
  )
}

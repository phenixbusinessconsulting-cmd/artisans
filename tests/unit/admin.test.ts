import { afterEach, describe, expect, it } from "vitest"
import { adminConfigure, motDePasseValide } from "@/lib/admin"

describe("mode administrateur", () => {
  const initial = process.env.ADMIN_PASSWORD
  afterEach(() => {
    process.env.ADMIN_PASSWORD = initial
  })

  it("désactivé sans mot de passe ou avec un mot de passe trop court", () => {
    delete process.env.ADMIN_PASSWORD
    expect(adminConfigure()).toBe(false)
    expect(motDePasseValide("")).toBe(false)
    process.env.ADMIN_PASSWORD = "court"
    expect(adminConfigure()).toBe(false)
    expect(motDePasseValide("court")).toBe(false)
  })

  it("vérifie le mot de passe exact", () => {
    process.env.ADMIN_PASSWORD = "MotDePasseTresLong42"
    expect(adminConfigure()).toBe(true)
    expect(motDePasseValide("MotDePasseTresLong42")).toBe(true)
    expect(motDePasseValide("MotDePasseTresLong4")).toBe(false)
    expect(motDePasseValide("motdepassetreslong42")).toBe(false)
  })
})

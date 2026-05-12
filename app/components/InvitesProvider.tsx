"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type EmployeeInvite = {
  email: string;
  status: "pending";
};

type InvitesContextValue = {
  invites: EmployeeInvite[];
  addInvite: (invite: EmployeeInvite) => void;
  removeInviteByEmail: (email: string) => void;
  clearInvites: () => void;
};

const KEY = "shiftly.invites.v1";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readInvites(): EmployeeInvite[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => {
        const o = x as Partial<EmployeeInvite>;
        if (!o.email) return null;
        return { email: normalizeEmail(o.email), status: "pending" as const };
      })
      .filter((x): x is EmployeeInvite => Boolean(x));
  } catch {
    return [];
  }
}

function writeInvites(invites: EmployeeInvite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(invites));
  } catch {
    // ignore
  }
}

const InvitesContext = createContext<InvitesContextValue | null>(null);

export function InvitesProvider({ children }: { children: ReactNode }) {
  const [invites, setInvites] = useState<EmployeeInvite[]>([]);

  useEffect(() => {
    setInvites(readInvites());
  }, []);

  useEffect(() => {
    writeInvites(invites);
  }, [invites]);

  const value = useMemo<InvitesContextValue>(
    () => ({
      invites,
      addInvite: (invite) => {
        const email = normalizeEmail(invite.email);
        setInvites((prev) => {
          if (prev.some((i) => normalizeEmail(i.email) === email)) return prev;
          return [...prev, { email, status: "pending" }];
        });
      },
      removeInviteByEmail: (email) => {
        const e = normalizeEmail(email);
        setInvites((prev) => prev.filter((i) => normalizeEmail(i.email) !== e));
      },
      clearInvites: () => setInvites([]),
    }),
    [invites],
  );

  return <InvitesContext.Provider value={value}>{children}</InvitesContext.Provider>;
}

export function useInvites() {
  const ctx = useContext(InvitesContext);
  if (!ctx) throw new Error("useInvites must be used within InvitesProvider");
  return ctx;
}


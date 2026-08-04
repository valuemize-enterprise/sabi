'use client';

// ═══════════════════════════════════════════════════════════════════
// frontend/src/app/(internal)/leave/page.tsx
// The staff-facing leave page — accessible to ALL staff roles.
// Renders LeaveRequestForm in full-page mode.
// ═══════════════════════════════════════════════════════════════════

import { LeaveRequestForm } from '@/components/leave/LeaveRequestForm';

export default function LeavePage() {
  return <LeaveRequestForm />;
}

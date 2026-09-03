export type TeamMember = {
  id: string;
  name: string;
  role: string | null;
  weeklyCapacity: number;
  active: boolean;
  sortOrder: number;
};

export type Client = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  sortOrder: number;
};

export type Allocation = {
  id: string;
  teamMemberId: string;
  clientId: string;
  weekStart: string; // YYYY-MM-DD
  hours: number;
};

export function cellKey(teamMemberId: string, clientId: string, weekStart: string) {
  return `${teamMemberId}|${clientId}|${weekStart}`;
}

export function utilClass(pct: number): "good" | "warn" | "bad" {
  if (pct <= 100) return "good";
  if (pct <= 115) return "warn";
  return "bad";
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Business = { id: string; name: string; slug: string };

export function WorkspaceSwitcher() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentId, setCurrentId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/businesses").then((r) => r.json()),
      fetch("/api/workspace/current").then((r) => r.json())
    ]).then(([list, current]) => {
      setBusinesses(list.businesses ?? []);
      setCurrentId(current.business?.id ?? "");
    }).catch(() => {});
  }, []);

  async function change(businessId: string) {
    setCurrentId(businessId);
    const response = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId })
    });

    if (response.ok) router.refresh();
  }

  if (!businesses.length) return null;

  return (
    <select
      value={currentId}
      onChange={(e) => change(e.target.value)}
      className="workspace-switcher"
      aria-label="Active workspace"
    >
      {businesses.map((business) => (
        <option key={business.id} value={business.id}>{business.name}</option>
      ))}
    </select>
  );
}

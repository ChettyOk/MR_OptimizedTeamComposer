"use client";

import { useMemo } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import type { ScoredTeam } from "@teamcomposer/optimizer";
import type { Hero } from "@/data/heroes";

type GraphNode = {
  id: string;
  label: string;
  role: Hero["role"] | "Unknown";
  x?: number;
  y?: number;
};

type GraphEdge = {
  source: string;
  target: string;
  weight: number;
};

function roleColor(role: GraphNode["role"]): string {
  if (role === "Vanguard") return "#f59e0b";
  if (role === "Duelist") return "#fb7185";
  if (role === "Strategist") return "#22d3ee";
  return "#94a3b8";
}

export function SynergyGraph({
  team,
  heroesById,
}: {
  team: ScoredTeam;
  heroesById: Map<string, Hero>;
}) {
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = team.team.map((id) => {
      const hero = heroesById.get(id);
      return { id, label: hero?.name ?? id, role: hero?.role ?? "Unknown" };
    });
    const edges: GraphEdge[] = [];
    for (let i = 0; i < team.team.length; i += 1) {
      for (let j = i + 1; j < team.team.length; j += 1) {
        const a = team.team[i];
        const b = team.team[j];
        const h1 = heroesById.get(a);
        const h2 = heroesById.get(b);
        const roleBonus = h1 && h2 && h1.role !== h2.role ? 0.2 : 0;
        edges.push({
          source: a,
          target: b,
          weight: 0.4 + roleBonus,
        });
      }
    }
    return { nodes, edges };
  }, [team, heroesById]);

  const layout = useMemo(() => {
    const width = 560;
    const height = 300;
    const nodes = graphData.nodes.map((n) => ({ ...n }));
    const edges = graphData.edges.map((e) => ({ ...e }));

    const sim = forceSimulation(nodes)
      .force("charge", forceManyBody().strength(-110))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide(22))
      .force(
        "link",
        forceLink(edges)
          .id((d) => (d as GraphNode).id)
          .distance((d) => 80 - d.weight * 20),
      )
      .stop();

    for (let i = 0; i < 120; i += 1) sim.tick();
    sim.stop();
    return { nodes, edges };
  }, [graphData]);

  return (
    <div className="mr-subpanel rounded-xl p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200/70">
        Synergy graph (team interaction view)
      </div>
      <svg viewBox="0 0 560 300" className="h-[300px] w-full rounded-lg bg-slate-950/50">
        {layout.edges.map((e) => {
          const s = layout.nodes.find((n) => n.id === e.source);
          const t = layout.nodes.find((n) => n.id === e.target);
          if (!s || !t) return null;
          return (
            <line
              key={`${e.source}-${e.target}`}
              x1={s.x ?? 0}
              y1={s.y ?? 0}
              x2={t.x ?? 0}
              y2={t.y ?? 0}
              stroke="#7dd3fc"
              strokeOpacity={0.35 + e.weight * 0.25}
              strokeWidth={1 + e.weight * 2}
            />
          );
        })}
        {layout.nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x ?? 0},${n.y ?? 0})`}>
            <circle r={16} fill={roleColor(n.role)} fillOpacity={0.9} stroke="#0f172a" strokeWidth={1.5} />
            <text y={30} textAnchor="middle" fontSize="10" fill="#dbeafe">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
